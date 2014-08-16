$(document).ready(function() {
    
    function encodeTerm(term) {
	var res = term.replace(/^\s+|\s+$/g, '');
	return res.replace(/\s+/g, "+");
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
    var citeboxTemplate = Handlebars.compile($("#citebox-template").html());

    $("#titlesearch").on("keyup", function() {
	var thisHolder = $(this);
	if (thisHolder.val().length < 2) {
	    resultsbox.empty();
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
	    var html = citeboxTemplate(book);
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
});
