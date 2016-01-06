var readline = require('readline');
var staff = require('./staff+names.json');
var names = require('./test.json');
var Fuse = require('fuse.js');
var latinize = require('latinize');
var fuzzysearch = require('fuzzysearch');
var jsdom = require("jsdom");
var https = require("https");
var querySelectorAll = require('query-selector');
var rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

var recursiveAsyncReadLine = function() {
	var startQuestions = ["Czy masz jakieś pytanie?\n", "Czego chciałbyś się dowiedzieć?\n", "Proszę zadaj pytanie. :)\n"];
	var index = Math.floor((Math.random() * 3) + 1) - 1;

	console.log("")
	rl.question(startQuestions[index], function(question) {

		searchKeywords(question)
		recursiveAsyncReadLine();
	});
};
recursiveAsyncReadLine();

function sortObjectByProperty(object, property) {
	var sortedObject = object.slice(0);
	sortedObject.sort(function(a, b) {
		return a[property] - b[property]
	})
	return sortedObject;
}

function deletePrepositions(question) {

	var prepositions = ['aby', 'aczkolwiek', 'albo', 'albowiem', 'ale', 'ani', 'az', 'azeby', 'bez', 'beze', 'bo', 'bodaj', 'byle', 'choc', 'chociaz', 'czy', 'czyli', 'czyz', 'dla', 'do', 'dokad', 'gdy', 'gdyz', 'gdzie', 'gdziez', 'i', 'ile', 'iz', 'jak', 'jaki', 'jakie', 'jako', 'mimo', 'na', 'na', 'nad', 'nade', 'niech', 'niechaj', 'nuz', 'o', 'oby', 'od', 'po', 'pod', 'poza', 'przed', 'przede', 'przez', 'przeze', 'przy', 'spod', 'spode', 'sprzed', 'sprzede', 'ten', 'to', 'u', 'w', 'we', 'z', 'za', 'za', 'ze',
		'znad'
	];
	for (var i = 0; i < question.length; i++) {
		for (var j = 0; j < prepositions.length; j++) {
			if (latinize(question[i].toLowerCase()) === prepositions[j]) {
				question[i] = ""
			}
		}
	}
	var cleanedQuestion = question.filter(function(n) {
		return n !== ""
	});
	return cleanedQuestion;
}

function searchKeywords(question) {
	var keywords = {
		"pokoj": ["pokoj", "pokoje", "pokoju", "pokoik", "pokoiczek", "pomieszczenie", "izba", "gabinet", "gabinecie", "salka", "miejsce", "miejscu"],
		"tel": ["tel", "telefon", "telefonu", "telefony", "telefonie", "aparat", "komorka", "komorce", "komorkowy", "komorkowego", "aparatu"],
		"mail": ["mailowy", "mail", "email", "e-mail", "maila", "emaila", "e-maila"],
		"www": ["strona", "strony", "stronie", "internetowa", "internetowej", "www", "html", "witryna", "witryny", "portal", "portalu", "wizytowka", "wizytowki", "url"],
		"stopien": ["stopien", "naukowy", "poziom", "poziomie", "stanowisko", "stanowisku", "stanowiskiem", "doktor", "doktorze", "doktora", "profesor", "profesora", "profesorze", "magister", "magistra", "magistrze"],
		"info": ["info", "informacja", "informacje", "wszystko"]
	}


	var splittedQuestion = deletePrepositions(question.split(" "))
	var foundKeywords = [];

	for (var i = 0; i < splittedQuestion.length; i++) {
		for (key in keywords) {
			for (var j = 0; j < keywords[key].length; j++) {
				if (splittedQuestion[i].length >= 3 && fuzzysearch(latinize(splittedQuestion[i].toLowerCase()), keywords[key][j])) {
					foundKeywords.push(key);
					splittedQuestion[i] = "" //maybe add numer adres to not delete
				}
			}
		}
	}

	var cleanedSplittedQuestion = splittedQuestion.filter(function(n) {
		return n !== ""
	});

	if (foundKeywords.length > 0) {
		fuzzySearchName(cleanedSplittedQuestion, foundKeywords)
	} else {
		console.log('Brak słów kluczowych')
	}

}

function fuzzySearchName(splittedQuestion, foundKeywords) {
	var lowestScore = 0;
	result = [];
	items = [];

	var options = {
		caseSensitive: false,
		includeScore: false,
		shouldSort: true,
		threshold: 1.0,
		location: 0,
		distance: 100,
		maxPatternLength: 140,
		keys: ['imie', 'nazwisko'],
		include: ['score']
	};

	// search name and surname by fuzzy search from database
	var fuse = new Fuse(names, options);
	for (var i = 0; i < splittedQuestion.length; i++) {
		if (splittedQuestion[i + 1] !== undefined && splittedQuestion[i].length >= 4 && splittedQuestion[i + 1].length >= 4 || splittedQuestion.length <= 2) { // >=4 for not checking very short words
			var result = fuse.search(splittedQuestion[i] + " " + splittedQuestion[i + 1])
			lowestScoreInCurrentResult = result[0].score;

			for (var j = 0; j < result.length; j++) {
				if (lowestScoreInCurrentResult == result[j].score) {
					items.push(result[j])
				}
			}

		}
		lowestScoreInCurrentResult = 0;
	}
	var sorted = sortObjectByProperty(items, 'score');

	// search the best probably surnames
	for (var i = 0; i < sorted.length; i++) {
		var name = latinize(sorted[i].item.imie.toLowerCase());
		surname = latinize(sorted[i].item.nazwisko.toLowerCase());
		passedRegex = 0;

		for (var j = 0; j < splittedQuestion.length; j++) {
			if (name.search(latinize(splittedQuestion[j].substr(0, 4)).toLowerCase()) !== -1) {
				passedRegex = passedRegex + 1;
			}
			if (surname.search(latinize(splittedQuestion[j].substr(0, 4)).toLowerCase()) !== -1) {
				passedRegex = passedRegex + 1;
			}
		}
		sorted[i].success = passedRegex;
	}

	var sortedBySuccess = sortObjectByProperty(sorted, 'success')
	try {
		var maxSuccess = sortedBySuccess.slice(-1)[0].success;
		if (maxSuccess !== 0) {

			// create unique array from set of the best probably surnames
			var set = new Set();
			for (key in sortedBySuccess) {
				if (sortedBySuccess[key]['success'] == maxSuccess) {
					set.add(sortedBySuccess[key]['item'])
				}
			}
			var employees = Array.from(set);
			if (employees.length === 1) {
				getInformationAboutEmployee(employees[0].id, foundKeywords);
			} else {
				for (var i = 0; i < employees.length; i++) {
					console.log([i] + ".", employees[i].imie, employees[i].nazwisko);
				}
				rl.question("\nDoprecyzuj o jaką osobę chciałeś zapytać, podaj numer pracownika z listy przedstawionej powyżej.", function(anwser) {
					getInformationAboutEmployee(employees[anwser].id, foundKeywords);
					recursiveAsyncReadLine();
				});
			}
		} else {
			console.log("Sprecyzuj swoje pytanie.")
		}
	} catch (e) {
		console.log("Brak wyników.")
	}
}

function getInformationAboutEmployee(id, keywords) {
	var counts = {};
	keywords.forEach(function(x) {
		counts[x] = (counts[x] || 0) + 1;
	});

	var counterKeyword = 0;
	var mostCommonKeyword = Object.keys(counts)[0];

	for (key in counts) {
		if (counterKeyword < counts[key]) {
			counterKeyword = counts[key]
			mostCommonKeyword = key
		}
	}
	var employee = staff[id].imie + " " + staff[id].nazwisko;
	switch (mostCommonKeyword) {
		case 'stopien':
			console.log("Stopień naukowy pracownika: " + employee + ", to " + staff[id].stopien);
			break;
		case 'pokoj':
			console.log(employee + " - pokój: " + staff[id].pokoj)
			break;
		case 'tel':
			console.log(employee + " - telefon: " + staff[id].tel)
			break;
		case 'www':
			if (staff[id].www !== undefined) {
				console.log(employee + " - adres strony internetowej: " + staff[id].www)
			} else {
				console.log('Niestety pracownik ' + employee + " nie posiada strony internetowej.")
			}
			break;
		case 'mail':
			console.log(employee + " - e-mail: " + staff[id].mail)
			break;
		case 'info':
			console.log("Pracownik: " + employee);
			console.log("- stopień naukowy: " + staff[id].stopien)
			console.log("- pokój: " + staff[id].pokoj)
			console.log("- telefon: " + staff[id].tel)
			console.log("- e-mail: " + staff[id].mail)
			console.log("- www: " + staff[id].www)
			break;
	}
	console.log("______________________");
}


function getNewsAboutDepartment() {
	console.log("Pobieranie informacji...")
	return new Promise(function(resolve, reject) {

		var body;
		var informators = {}

		https.get("https://info.wmi.amu.edu.pl/", function(res) {
			res.setEncoding('utf8');
			res.on('data', function(chunk) {
				var dom = jsdom.defaultLevel;

				var document = jsdom.jsdom(chunk, {
					features: {
						QuerySelector: true
					}
				});

				var index = 0;

				var a = document.querySelector('#informatorsHome')
				if (a != null) {
					var b = a.querySelectorAll('ul');
					for (var i = 0; i < b.length; i++) {
						for (var j = 0; j < b[i].querySelectorAll('li').length; j++) {
							if (b[i].querySelectorAll('li')[j].textContent[0] === "R") {
								var year = b[i].querySelectorAll('li')[j].textContent;
								index = 0;
							} else {
								var href = b[i].querySelectorAll('li')[j].innerHTML;
								var month = b[i].querySelectorAll('li')[j].textContent;
								index = index + 1;
							}
							if (index == 0) {
								informators[year] = {}
							} else {
								var a = href.substr(href.indexOf('="') + 2);
								var preparedHref = 'https://info.wmi.amu.edu.pl' + a.substr(0, a.indexOf(">") - 1)
								informators[year][month] = preparedHref;
							}
						}
					}
				}
				resolve(informators)
			});
		});
	});
}

function itterate(informators){
	console.log('poszlo')

	for (key in informators) {
		console.log('wypisuje', key)
		console.log(informators[key])
	}
}

function test(){
	return getNewsAboutDepartment()
		.then(itterate)
}

test();