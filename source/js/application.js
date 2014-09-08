$(document).ready(function() {

    // Fake search server that only returns books with pictures.

    function BookSearcher(term) {
	// do stuff
	var books = [];
	var deferred;
	var newBooks = [];
	var currentIndex;
	var apiOffset = 0;
	var apiLimit = 30;
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
	function getMoreBooks(offset, limit) {
	    var url = "http://openlibrary.org/search.json?q=" + encodeTerm(term)+"&limit=" + String(apiLimit) + "&offset=" + String(apiOffset);
	    request = $.getJSON(url, function(data){
		// ... inside success handler.
		var rawBooks = processData(data);
		for (var i = 0, l = rawBooks.length; i < l; i++) {
		    var rawBook = rawBooks[i];
		    if (rawBook) {
			if ("cover_i" in rawBook)
			    newBooks.push(rawBook);
			if (newBooks.length == 10) {
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
		    apiOffset += apiLimit;
		    getMoreBooks(offset, limit);
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
	    deferred = $.Deferred();
	    if (limit + offset <= books.length || apiLimit + apiOffset >= apiNumFound) {
		pageProcess(offset, limit);
		deferred.resolve(books.slice(offset, offset+limit));
	    } else {
 		getMoreBooks(offset, limit);
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
		request.abort();
		deferred.reject();
	    }
	}
    }

    // Object containing everything relating to making the citation
    function Citation(info) {
	function capitalize(value) {
	    var index;
	    var character;
	    value = trimWhiteSpace(value).toLowerCase();
	    while ((index = value.search(/(^|\s+)([a-z])/)) >= 0) {
		while ((character = value.charAt(index)) == " ")
		    index++;
		value = value.slice(0, index) + character.toUpperCase() + value.substr(index + 1);
	    }
	    return value;
	}

	function trimWhiteSpace(value) {
	    return value.replace(/^\s+|\s+$/g, "");
	}

	function capitalizeFirstWord(value) {
	    value = trimWhiteSpace(value).toLowerCase();
	    return value.charAt(0).toUpperCase() + value.substr(1);
	}

	function initialize(value) {
	    var capitalized = capitalize(value);
	    return capitalized.replace(/(^|\s+)(\w)\w*($|\s+)/g, "$1$2.$3")
	}

	if (info.type == 1) {
	    this.citation = mla();
	} else if (info.type == 2) {
	    this.citation = apa();
	} else {
	    this.citation = chicago();
	}
	

	function apa() {
	    var result = ["", "", ""];
	    result[0] += capitalize(info.lastName) + ", ";
	    if (info.firstName)
		result[0] += initialize(info.firstName) + " ";
	    if (info.year) {
		result[0] += "(" + info.year + "). ";
	    } else {
		result[0] += "(n.d.). ";
	    }
	    if (info.chapter)
		result[0] += capitalizeFirstWord(info.chapter) + " In ";
	    result[1] += capitalizeFirstWord(info.title) + " ";
	    if (info.edition || info.volume || info.pages) {
		var edVolPages = [];
		result[2] += "(";
		if (info.edition)
		    edVolPages.push("Edition " + info.edition + ".");
		if (info.volume)
		    edVolPages.push("Vol. " + capitalizeFirstWord(info.volume));
		if (info.pages)
		    edVolPages.push("p. " + capitalizeFirstWord(info.pages));
		result[2] += edVolPages.join(", ");
		result[2] += "), ";
	    }
	    if (info.city)
		result[2] += capitalize(info.city) + ": ";
	    if (info.publisher)
		result[2] += capitalize(info.publisher) + ". ";
	    return result;
	}

	function mla() {
	    var result = ["", "", ""];
	    result[0] += capitalize(info.lastName);
	    if (info.firstName)
		result[0] += ", " + capitalize(info.firstName) + ".";
	    if (info.chapter)
		result[0] += " \"" + capitalize(info.chapter) + ".\" ";
	    result[1] += " " + capitalize(info.title) + ". ";
	    if (info.edition)
		result[2] += capitalize(info.edition) + " ed .";
	    if (info.volume)
		result[2] += "Vol. " + capitalize(info.volume) + ". ";
	    if (info.city)
		result[2] += capitalize(info.city) + ": ";
	    if (info.publisher) {
		var pub = info.publisher.replace(/^(an*|the)/i, "");
		pub = pub.replace(/\s+(co(mpany)?|corp(oration)?|inc(orporated)?|ltd|limited)\.?(\b|$)/gi, "");
		pub = pub.replace(/\b(books?|house|press|publisher)(\s*|$)/ig, "$2");
		pub = pub.replace(/^\s+|\s+$/g, "");
		result[2] += capitalize(pub) + ",";
	    }
	    if (info.year)
		result[2] += " " + info.year;
	    result[2] += ".";
	    if (info.pages)
		result[2] += " " + capitalize(info.pages) + ".";
	    result[2] += " Print.";
	    return result;
	}

	function chicago() {
	    var result = ["", "", ""];
	    result[0] += capitalize(info.lastName);
	    if (info.firstName)
		result[0] += ", " + capitalize(info.firstName);
	    result[0] += ". ";
	    if (info.chapter)
		result[0] += "\"" + capitalize(info.chapter) + ".\" In ";
	    result[1] += capitalize(info.title);
	    if (info.pages)
		result[2] += ", " + info.pages.toLowerCase();
	    result[2] += ". ";
	    if (info.edition)
		result[2] += capitalize(info.edition) + " ed. ";
	    if (info.volume)
		result[2] += "Vol. " + capitalize(info.volume) + ". ";
	    if (info.city)
		result[2] += capitalize(info.city) + ": ";
	    if (info.publisher)
		result[2] += capitalize(info.publisher) + ", ";
	    if (info.year)
		result[2] += info.year;
	    result[2] += ".";
	    return result;
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
    

    // Variable allowing all listeners to access array of books
    var searchResults;

    // Allow all listeners to access searcher, offset, and limit
    var searcher;
    var searchTerm;
    var offset;
    var limit = 10;

    var searchers = {};
    function getSearcher(term) {
	if (!(searchers.hasOwnProperty(term)))
	    searchers[term] = new BookSearcher(term);
	return searchers[term];
    }

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

    function removeWhiteSpace(value) {
	    return value.replace(/^\s+|\s+$/g, "");
    }
    
    // Function that executes search with keystrokes in the search input.
    $searchfield.on("input", function() {
	if (searchTerm == $searchfield.val())
	    return;
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
	    if (searcher)
		searcher.cancel();
	    searchTerm = removeWhiteSpace($searchfield.val());
	    searcher = getSearcher(searchTerm);
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


    // Helper function for adding citation to the DOM
    function addCite(citation) {
	$citation = $("#citation");
	$citation.empty();
	$citation.append(citation.citation[0]);
	$citation.append("<span class=\"italic\">" + citation.citation[1] + "</span>");
	$citation.append(citation.citation[2]);
    }
    // Listener handling what happens when a search result is clicked
    $resultsbox.on("click", "li", function() {
	// Determine which book was clicked, fetch book data from API using its key
	var key = $(this).data("key");
	var selectedBook = searchResults[+key];
	$searchfield.addClass("loading");
	$.getScript(selectedBook.url, function() {
	    var book = processBook(_OLBookInfo["OLID:" + selectedBook.olid]);
	    // Empty and generate new $citebox content
	    $citebox.empty();
	    $citebox.append("<img src=\"http://covers.openlibrary.org/b/id/" + selectedBook.cover_i + "-L.jpg\" />");
	    
	    $citebox.append(citeboxTemplate(book));
	    var info = {};
	    info.title = book.title;
	    info.firstName = book.authors[0].firstName;
	    info.lastName = book.authors[0].lastName;
	    if (book.publish_places)
		info.city = book.publish_places[0].name;
	    if (book.publishers)
		info.publisher = book.publishers[0].name;
	    if (book.publish_year)
		info.year = book.publish_year;
	    info.type = 2;

	    var citation = new Citation(info);
	    addCite(citation);
	    // Reveal $citebox
	    $card.addClass("flip");
	    $searchfield.removeClass("loading");
	});
    });

    // Listener function for changes to citebox fields
    $citebox.on("input change", "input", function() {
	var info = {};
	info.title = $("#citetitle").val();
	info.firstName = $("#firstname").val();
	info.lastName = $("#lastname").val();
	info.city = $("#citecity").val();
	info.publisher = $("#citepublisher").val();
	info.year = $("#citepubyear").val();
	info.volume = $("#citevolume").val();
	info.edition = $("#citeedition").val();
	info.chapter = $("#citechapter").val();
	info.pages = $("#citepages").val();
	info.type = $("#citetype").val();
	var citation = new Citation(info)
	addCite(citation);
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
	    indicator.text("APA");
	else
	    indicator.text("Chicago");
    });
});
