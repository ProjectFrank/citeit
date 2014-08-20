$(document).ready(function() {

    // Encode the search term for use with the openlibrary search API
    // Remove leading and trailing whitespace, replace whitespace between words
    // with a plus sign (+)
    function encodeTerm(term) {
	var res = term.replace(/^\s+|\s+$/g, '');
	var res2 = res.replace(/\s+/g, "+");
	return res2.replace("'", "%27");
    }    

    // Process the book data so that it is suitable for use with Handlebars.js
    function processData(data) {
	if ("docs" in data) {
	    var processed = data.docs.map(function(doc) {
		if ("edition_key" in doc) {
		    return doc;
		}
		return {};
	    });
	    return processed;
	}		    
    }

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

    var timer;

    // Declare request variable to later refer to JSON request and abort it.
    var request;

    // Declare books variable to access book data in all functions.
    var booksWithPics;

    // Declare and initialize jQuery elements
    var resultsbox = $("div.resultsbox");
    var citebox = $("div.citebox");
    var card = $("div.card");

    // Compile Handlebars.js templates
    var resultsTemplate = Handlebars.compile($("#searchresults-template").html());
    var pageselectTemplate = Handlebars.compile($("#pageselect-template").html());
    var citeboxTemplate = Handlebars.compile($("#citebox-template").html());
    
    // Declare variable ensuring that slideDown effect only occurs once.
    var slid;

    // Function that executes search with keystrokes in the search input.
    $("#titlesearch").on("keyup", function() {
	var thisHolder = $(this);
	if (thisHolder.val().length < 2) {
	    resultsbox.empty();
	    card.removeClass("flip");
	    return;
	}


	// Timer calls function if no keystrokes for 500ms
	clearTimeout(timer);
	timer = setTimeout(function() {
	    // Declare variables accessible to all callback functions
	    booksWithPics = [];
	    var numBooks = 0;
	    var offset = 0;
	    var numFound;
	    var url = "http://openlibrary.org/search.json?q=" + encodeTerm(thisHolder.val())+"&limit=20&offset=";

	    // Add loading animation
	    thisHolder.addClass("loading");

	    // Send JSON request
	    console.log("New request sent");
	    request = $.getJSON(url + String(offset)).then(success).then(compile, fail);

	    // Function called if success is done
	    function compile() {
		card.removeClass("flip");
		resultsbox.empty();
		resultsbox.append(resultsTemplate(booksWithPics));
		if (!slid) {
		    resultsbox.slideDown();
		    slid = true;
		}
		thisHolder.removeClass("loading");
	    }
	    
	    // Function called if success is rejected
	    function fail() {
		offset += 20;
		// Call everything again and again until success is done
		return $.getJSON(url + String(offset)).then(success).then(compile, fail);
	    }
	    
	    function success(data) {
		var deferred = $.Deferred();
		numFound = data.numFound;
		var books = processData(data);
		for(var i = 0, j = books.length; i < j; i++) {
		    if ("cover_i" in books[i]) {
			booksWithPics.push(books[i])
		    }
		    if (booksWithPics.length == 10) {
			i = j;
			deferred.resolve();
			return deferred.promise();
		    }
		    console.log(i);
		}
		if (offset + 20 > numFound)
		    deferred.resolve();
		else if (booksWithPics.length < 10)
		    deferred.reject();
		return deferred.promise();
	    }
		    
	    // request = $.getJSON(url, function(data) {
	    // 	books = processData(data);
	    // 	thisHolder.removeClass("loading");

	    // 	// Remove search results before new search is made
	    // 	resultsbox.empty();

	    // 	// Unflip the card if it is not already unflipped
	    // 	card.removeClass("flip");

	    // 	// Add new search results
	    // 	resultsbox.append(resultsTemplate(books));

	    // 	// Calculate number of pages of search results (5 per page)
	    // 	var numPages = Math.min(10, Math.ceil(data.numFound / 5));

	    // 	// Create array of objects for Handlebars.js template
	    // 	var pageArray = [];
	    // 	for (var i = 1; i <= numPages; i++)
	    // 	    pageArray.push({page: String(i)});
	    // 	resultsbox.append(pageselectTemplate(pageArray));
	    // 	$(".pageselector").first().addClass("highlight");
	    // 	if(!slid) {
	    // 	    resultsbox.slideDown();
	    // 	    slid=true;
	    // 	}
	    // });
	}, 500);
    });




    // Function handling what happens when a search result is clicked
    $("div.resultsbox").on("click", "li", function() {
	
	// Determine which book was clicked, fetch book data from API using its key
	var key = $(this).data("key");
	var selectedBook = booksWithPics[+key];
	var olid = selectedBook.edition_key[0];
	var url = "https://openlibrary.org/api/books?bibkeys=OLID:"+ olid +"&jscmd=data";
	$("#titlesearch").addClass("loading");
	$.getScript(url, function() {
	    var book = processBook(_OLBookInfo["OLID:" + olid]);
	    var edition_keys = selectedBook.edition_key.map(function(editionKey) {
		return {"key": editionKey};
	    });
	    // Empty and generate new citebox content
	    citebox.empty();
	    citebox.append("<img src=\"http://covers.openlibrary.org/b/id/" + selectedBook["cover_i"] + "-L.jpg\"/>");
	    citebox.append(citeboxTemplate(book));

	    // Reveal citebox
	    card.addClass("flip");

	    $("#titlesearch").removeClass("loading");
	});
    });

    // Listener function for "Back to results" button
    citebox.on("click", "button", function() {
	card.removeClass("flip");
    });

    // Listener function for page selector in search results
    resultsbox.on("click", ".pageselector", function() {
	var offset = String((+$(this).data("page") - 1) * 5);
	var url = "http://openlibrary.org/search.json?q=" + encodeTerm($("#titlesearch").val())+"&limit=5&offset=" + offset;
	$(".pageselector").removeClass("highlight");
	$(this).addClass("highlight");
	$("#titlesearch").addClass("loading");
	$.getJSON(url, function(data) {
	    
	    // Use remove instead of empty in this instance to avoid removing the page selector within resultsbox
	    resultsbox.find("ul").remove();
	    books = processData(data);
	    // Add search results to beginning of resultsbox, before pageselector
	    resultsbox.prepend(resultsTemplate(books));
	    $("#titlesearch").removeClass("loading");
	});
    });
    
});
