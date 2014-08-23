$(document).ready(function() {

    // Fake search server that only returns books with pictures.

    function BookSearcher(term) {
	// do stuff
	var books = [];
	var newBooks = [];
	var currentIndex;
	
	var apiOffset = 0;
	var apiLimit = 100;
	var apiNumFound;
	this.moreBooksLeft = false;
	this.moreBooksRight = false;
	var self = this;
	var request;

	// Helper to process book data so that it is suitable for Handlebars.js
	function processData(data) {
	    apiNumFound = data.numFound;
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

	// combine books and newBooks array, reset newBooks
	function updateBooks() {
	    books = books.concat(newBooks);
	    newBooks = [];
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
	function getMoreBooks(deferred, offset, limit) {
	    var url = "http://openlibrary.org/search.json?q=" + encodeTerm(term)+"&limit=" + String(apiLimit) + "&offset=" + String(apiOffset);
	    request = $.getJSON(url, function(data){
		// ... inside success handler.
		var rawBooks = processData(data);
		for (var i = 0, l = rawBooks.length; i < l; i++) {
		    var rawBook = rawBooks[i];
		    if (rawBook) {
			if ("cover_i" in rawBook)
			    newBooks.push(rawBook);
			if (newBooks.length == 50) {
			    i = l;
			    updateBooks();
			    pageProcess(offset, limit);
			    apiOffset += i + 1;
			    deferred.resolve(books.slice(offset, offset+limit));
			    return;
			}
		    }
		}
		if (apiOffset + apiLimit > apiNumFound) {
		    updateBooks();
		    apiOffset = apiNumFound;
		    pageProcess(offset, limit);
		    deferred.resolve(books.slice(offset, offset+limit));	    
		}
		else if (deferred.state() == "pending") {
		    apiOffset += 100;
		    getMoreBooks(deferred, offset, limit);
		}
	    });
	}

	function pageProcess (offset, limit) {
	    if (offset == 0) {
		self.moreBooksLeft = false;
	    } else {
		self.moreBooksLeft = true;
	    }
	    if (apiLimit + apiOffset < apiNumFound || offset + limit < books.length) {
		self.moreBooksRight = true;
	    } else {
		self.moreBooksRight = false;
	    }
	}

	this.search = function (offset, limit) {
	    var deferred = $.Deferred();
	    if (limit + offset <= books.length || apiLimit + apiOffset >= apiNumFound) {
		pageProcess(offset, limit);
		deferred.resolve(books.slice(offset, offset+limit));
	    } else {
 		getMoreBooks(deferred, offset, limit);
	    }
	    setTimeout(function() {
		self.cancel();
		updateBooks();
		pageProcess(offset, limit);
		deferred.resolve(books.slice(offset, offset+limit));
	    }, 10000);
	    pageProcess(offset, limit);
	    return deferred.promise();
	}

	this.cancel = function () {
	    if (request) {
		console.log("getJSON aborted");
		request.abort();
	    }
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
    var citeboxTemplate = Handlebars.compile($("#citebox-template").html());
    
    // Declare variable ensuring that slideDown effect only occurs once.
    var slid;

    // Variable allowing all listeners to access array of books
    var searchResults;

    // Allow all listeners to access searcher, offset, and limit
    var searcher;
    var offset;
    var limit = 10;

    // Helper to update array of search results and add them to the DOM
    function compile(books) {
	$(".arrow").removeClass("active");
	searchResults = books;
	$resultsbox.empty();
	$resultsbox.append(resultsTemplate(books));
	if (searcher.moreBooksLeft)
	    $("#leftarrow").attr("class", "arrow active");
	if (searcher.moreBooksRight)
	    $("#rightarrow").attr("class", "arrow active");
	$resultsbox.slideDown();
	$searchfield.removeClass("loading");
    }
    // Function that executes search with keystrokes in the search input.
    $searchfield.on("keyup", function() {
	$resultsbox.slideUp();
	if ($searchfield.val().length < 2) {
	    $resultsbox.empty();	    
	    return;
	}
	// Timer calls search if no keystrokes for 500ms
	clearTimeout(timer);
	timer = setTimeout(function() {
	    // Add loading animation
	    $searchfield.addClass("loading");
	    // Send JSON request
	    console.log("New request sent");
	    if (searcher)
		searcher.cancel();
	    searcher = new BookSearcher($searchfield.val());
	    offset = 0;
	    searcher.search(offset, limit).then(compile);		    
	}, 500);
    });

    // Listener functions for page navigation
    $resultsbox.on("click", "#leftarrow.active", function() {
	$searchfield.addClass("loading");
	$("#leftarrow").attr("class", "arrow");
	offset = Math.max(offset - limit, 0);
	searcher.search(offset, limit).then(compile);
    });
    $resultsbox.on("click", "#rightarrow.active", function() {
	$searchfield.addClass("loading");
	$("#rightarrow").attr("class", "arrow");
	offset += limit;
	searcher.search(offset, limit).then(compile);
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
