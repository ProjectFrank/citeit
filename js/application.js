$(document).ready(function() {
    
    function encodeTerm(term) {
	var res = term.replace(/^\s+|\s+$/g, '');
	return res.replace(/\s+/g, "+");
    }
    
    function buildBullet(book) {
	var list = "<ul class=\"suggestions\">";
	if (book.title)
	    list += "<li class=\"title\">" + book.title + "</li>";
	if (book.author_name)
	    list += "<li class=\"author\">" + book.author_name + "</li>";
	if (book.cover_i) {
	    var cover_url = "http://covers.openlibrary.org/b/id/" + book.cover_i + "-S.jpg";
	    list += "<li class=\"cover\"><img src=\"" + cover_url + "\"/></li>";
	}
	list += "</ul>";
	return list;
    }

    function processData(data) {
	if ("docs" in data) {
	    var processed = data.docs.map(function(doc) {
		if ("edition_key" in doc) {
		    doc.key = doc.edition_key[0];
		    return doc;
		}
		return {};
	    });
	    return processed;
	}		    
    }

    var timer;
    var request;
    var books;
    var resultsbox = $("div.resultsbox");
    var citebox = $("div.citebox");
    var resultsTemplate = Handlebars.compile($("#searchresults-template").html());
    var pageselectTemplate = Handlebars.compile($("#pageselect-template").html());
    $("#titlesearch").on("keyup", function() {
	var thisHolder = $(this);
	var suggestionBox = $(this).next();
	if (thisHolder.val().length < 2) {
	    resultsbox.empty();
	    suggestionBox.empty();
	    return;
	}
	if (request)
	    request.abort();
	clearTimeout(timer);
	timer = setTimeout(function() {
	    var url = "http://openlibrary.org/search.json?q=" + encodeTerm(thisHolder.val())+"&limit=5&offset=0";
	    thisHolder.addClass("loading");
	    request = $.getJSON(url, function(data) {
		console.log("ajax sent");
		books = processData(data);

		// suggestionBox.empty();
		// var source = $("#books-template").html();
		// var template = Handlebars.compile(source);
		// var html = template(books);
		// suggestionBox.append(html);
		// suggestionBox.slideDown();
		thisHolder.removeClass("loading");
		
		resultsbox.empty();
		citebox.slideUp();
		resultsbox.append(resultsTemplate(books));
		var numPages = Math.min(10, Math.ceil(data.numFound / 5));
		var pageArray = [];
		for (var i = 1; i <= numPages; i++)
		    pageArray.push({page: String(i)});
		resultsbox.append(pageselectTemplate(pageArray));
		$(".pageselector").first().addClass("highlight");
		if (books.length > 0)
		    resultsbox.slideDown();	
	    });
	}, 500);
    });

    var editionKey;
    var book;
    $("div.resultsbox").on("click", "li", function() {
	var key =$(this).data("key");
	books.forEach(function(doc) {
	    if (key == doc.key)
		editionKey = key;
	});
	var url = "https://openlibrary.org/api/books?bibkeys=OLID:"+editionKey+"&jscmd=data";
	$("#titlesearch").addClass("loading");
	$.getScript(url, function() {
	    book = _OLBookInfo["OLID:"+editionKey];
	    if (book.authors)
		book.author = book.authors[0].name;
	    if (book.publishers)
		book.publisher = book.publishers[0].name;
	    var source = $("#citebox-template").html();
	    var html = Handlebars.compile(source)(book);
	    citebox.empty();
	    citebox.append(html);
	    $("div.resultsbox").slideUp();
	    $("#titlesearch").removeClass("loading");
	    citebox.slideDown();
	});
    });

    citebox.on("click", "button", function() {
	citebox.slideUp();
	resultsbox.slideDown();
    });	
	
    $("html").on("click", function() {
	$(".suggestions-container").slideUp();
    });

    resultsbox.on("click", ".pageselector", function() {
	var offset = String((+$(this).data("page") - 1) * 5);
	var url = "http://openlibrary.org/search.json?q=" + encodeTerm($("#titlesearch").val())+"&limit=5&offset=" + offset;
	$(".pageselector").removeClass("highlight");
	$(this).addClass("highlight");
	$("#titlesearch").addClass("loading");
	$.getJSON(url, function(data) {
	    resultsbox.find("ul").remove();
	    books = processData(data);
	    resultsbox.prepend(resultsTemplate(books));
	    $("#titlesearch").removeClass("loading");
	});
    });
    // $("#authorsearch").on("keyup", function() {
    // 	var thisHolder = $(this);
    // 	var suggestionBox = $(this).next();
    // 	if (thisHolder.val().length < 2) {
    // 	    suggestionBox.empty();
    // 	    return;
    // 	}
    // 	if (request)
    // 	    request.abort();
    // 	clearTimeout(timer);
    // 	timer = setTimeout(function() {
    // 	    var url = "http://openlibrary.org/search/authors.json?q=" + encodeTerm(thisHolder.val())+"&limit=5";
    // 	    var authors = [];
    // 	    thisHolder.addClass("loading");
    // 	    request = $.getJSON(url, function(data) {
    // 		authors = data.docs.map(function(author) {
    // 		    return author;
    // 		});
    // 		suggestionBox.empty();
    // 		var source = $("#authors-template").html();
    // 		var template = Handlebars.compile(source);
    // 		var html = template(authors);
    // 		suggestionBox.append(html);
    // 		suggestionBox.slideDown();
    // 		thisHolder.removeClass("loading");
    // 	    });	    
    // 	}, 500);
    // });
});
