$(document).ready(function() {

    // Fake search server that only returns books with pictures.

    function BookSearcher(term) {
	// do stuff
	var books = [];
	var currentIndex;
	
	var apiOffset = 0;
	var apiLimit = 100;
	
	var self = this;
	var request;

	// Helper to process book data so that it is suitable for Handlebars.js
	function processData(data) {
	    if ("docs" in data) {
		var processed = data.docs.map(function(doc) {
		    if ("edition_key" in doc) {
			doc.olid = doc.edition_key[0];
			doc.url = "https://openlibrary.org/api/books?bibkeys=OLID:"+ doc.olid +"&jscmd=data";
			return doc;
		    }
		    return null;
		});
		return processed;
	    }		    
	}

	// Encode the search term for use with the openlibrary search API
	// Remove leading and trailing whitespace, replace whitespace between words
	// with a plus sign (+)
	// Replace apostrophes with $27	
	function encodeTerm(term) {
	    var res = term.replace(/^\s+|\s+$/g, '');
	    var res2 = res.replace(/\s+/g, "+");
	    return res2.replace("'", "%27");
	}

	// iterate filling up books
	function getMoreBooks(deferred) {
	    var url = "http://openlibrary.org/search.json?q=" + encodeTerm(term)+"&limit=" + String(apiLimit) + "&offset=" + String(apiOffset);
	    request = $.getJSON(url, function(data){
		// ... inside success handler.
		var rawBooks = processData(data);
		for (var i = 0, l = rawBooks.length; i < l; i++) {
		    var rawBook = rawBooks[i];
		    if (rawBook) {
			if ("cover_i" in rawBook)
			    books.push(rawBook);
			if (books.length == 50) {
			    i = l;
			    apiOffset += i + 1;
			    deferred.resolve(books);
			}
		    }
		}
		if (rawBooks.length < apiLimit)
		    deferred.resolve(books);
		else if (deferred.state() == "pending") {
		    apiOffset += 100;
		    getMoreBooks();
		}
	    });
	}
	
	this.search = function (offset, limit) {
	    var deferred = $.Deferred();
	    if (limit + offset <= books.length) {
		deferred.resolve(books.slice(offset, offset+limit));
	    } else {
 		getMoreBooks(deferred);
	    }
	    return deferred.promise();
	}

	this.cancel = function () {
	    if (request)
		request.abort();
	}
    }

    // Helper function to split authors and parse out publishing date.
    function processBook(book) {
	if ("authors" in book) {
	    book.authors = book.authors.map(function(author) {
		var name = author.name;
		var lastNameIndex = name.search(/\w+$/);
		var lastName = name.substring(lastNameIndex);
		var firstName = name.substring(0, lastNameIndex);
		firstName = firstName.replace(/^\s+|\s+$/g, '');
		return {"firstName": firstName, "lastName": lastName};
	    });
	}
	if ("publish_date" in book) {
	    var indexOfYear = book.publish_date.search(/\d{4}/);
	    book.publish_year = book.publish_date.substring(indexOfYear, indexOfYear + 4);
	}
	return book;
    }

    // Timer for keyboard activity
    var timer;

    // Declare and initialize jQuery elements
    var $resultsbox = $("div.resultsbox");
    var $citebox = $("div.citebox");
    var $card = $("div.card");
    var $searchfield = $("#titlesearch");

    // Compile Handlebars.js templates
    var resultsTemplate = Handlebars.compile($("#searchresults-template").html());
    var pageselectTemplate = Handlebars.compile($("#pageselect-template").html());
    var citeboxTemplate = Handlebars.compile($("#citebox-template").html());
    
    // Declare variable ensuring that slideDown effect only occurs once.
    var slid;

    // Variable allowing all listeners to access array of books
    var searchResults;

    // Allow all listeners to access searcher
    var searcher;

    // Helper to update array of search results and add them to the DOM
    function compile(books) {
	searchresults = books;
	$resultsbox.append(resultsTemplate(books));
	$searchfield.removeClass("loading");
    }
    // Function that executes search with keystrokes in the search input.
    $searchfield.on("keyup", function() {
	var thisHolder = $(this);
	if (thisHolder.val().length < 2) {
	    $resultsbox.empty();
	    $card.removeClass("flip");
	    return;
	}
	// Timer calls search if no keystrokes for 500ms
	clearTimeout(timer);
	timer = setTimeout(function() {
	    // Add loading animation
	    thisHolder.addClass("loading");
	    // Send JSON request
	    console.log("New request sent");
	    if (searcher)
		searcher.cancel();
	    searcher = new BookSearcher($searchfield.val());
	    searcher.search(0, 10).then(compile);		    
	}, 500);
    });

    // Function handling what happens when a search result is clicked
    $resultsbox.on("click", "li", function() {
	// Determine which book was clicked, fetch book data from API using its key
	var key = $(this).data("key");
	var selectedBook = searchResults[+key];
	$searchfield.addClass("loading");
	$.getScript(selectedBook.url, function() {
	    var book = processBook(_OLBookInfo["OLID:" + selectedBook.olid]);
	    var edition_keys = selectedBook.edition_key.map(function(editionKey) {
		return {"key": editionKey};
	    });
	    // Empty and generate new $citebox content
	    $citebox.empty();
	    $citebox.append("<img src=\"http://covers.openlibrary.org/b/id/" + selectedBook["cover_i"] + "-L.jpg\"/>");
	    $citebox.append(citeboxTemplate(book));

	    // Reveal $citebox
	    $card.addClass("flip");

	    $searchfield.removeClass("loading");
	});
    });

    // Listener function for "Back to results" button
    $citebox.on("click", "button", function() {
	$card.removeClass("flip");
    });

    // Listener function for page selector in search results
    $resultsbox.on("click", ".pageselector", function() {
	var offset = String((+$(this).data("page") - 1) * 5);
	var url = "http://openlibrary.org/search.json?q=" + encodeTerm($searchfield.val())+"&limit=5&offset=" + offset;
	$(".pageselector").removeClass("highlight");
	$(this).addClass("highlight");
	$searchfield.addClass("loading");
	$.getJSON(url, function(data) {
	    
	    // Use remove instead of empty in this instance to avoid removing the page selector within resultsbox
	    $resultsbox.find("ul").remove();
	    books = processData(data);
	    // Add search results to beginning of $resultsbox, before pageselector
	    $resultsbox.prepend(resultsTemplate(books));
	    $searchfield.removeClass("loading");
	});
    });

    // Listener for citetype slider in $citebox
    $citebox.on("change", "#citetype", function() {
	var data = $(this).val();
	var indicator = $("#typeindicator");
	if (data == 1)	    
	    indicator.text("MLA");
	else if (data == 2)
	    indicator.text("ALA");
	else
	    indicator.text("Chicago");
    });
});
