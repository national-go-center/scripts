const fs = require('fs')
const argv = require('yargs').argv
const cheerio = require('cheerio')

const html = fs.readFileSync(argv.file, 'utf8')
const $ = cheerio.load(html)
const data = {};

data.tournament = $('h1').first().text()
data.title = $('h1:nth-child(2)').text()
data.tables = []

$('table tr:not(:first-child)').each((i, row) => {
	const $row = $(row)
	const table = {}
	table.white = $row.find('td:nth-child(2)').text().trim()
	table.black = $row.find('td:nth-child(3)').text().trim()
	table.handicap = $row.find('td:nth-child(4)').text().trim()
	// table.result = $row.find('td:nth-child(5)').text().trim()
	data.tables.push(table)
})

let newFile = `
<html>
<head>
</head>
<style>
@import url(https://fonts.googleapis.com/css?family=Maven+Pro:400,500,700);@import url(https://fonts.googleapis.com/css?family=Exo:100,200,300,400,700);
html {
	box-sizing: border-box;
}
*, *:before, *:after {
	box-sizing: inherit;
}
body {
	font-family: 'Maven Pro', sans-serif;
	margin: 0;
	padding: 0;
}
.ngc-logo {
	left: 1%;
	width: 10%;
	position: absolute;
	top: 0;
}

.tables {
	margin-left: 12%;
	display: flex;
	flex-flow: column wrap;
	flex-direction: column;
	height: 100%;
}

.table {
	width: 50%;
	display: flex;
	height: 40px;
}

.table:nth-child(even) {
	background: #efefef;
}

.table > div {
	padding: 10px;
}

.number {
	color: #999;
	width: 10%;
	text-align: center;
	font-family: Exo;
	font-size: 18px;
	line-height: 1;
}

.white, .black {
	width: 35%;
	font-size: 10px;
}

.white {
}

.black {
	background: hsla(0, 0%, 10%, 0.8);
	color: #ccc;
}

.handicap {
	font-family: Exo;
}

.handicap:after {
	color: #999;
	content: 'stones';
	font-size: 10px;
	margin-left: 0.5em;
}

.result {
	color: #999;
	width: 10%;
	font-family: Exo;
}
</style>
<body>
<img class="ngc-logo" src="http://nationalgocenter.org/images/ngc-logo-4.svg" />
<div class="tables">
`

data.tables.forEach((table, i) => {
	newFile += `
	<div class="table">
		<div class="number">${i + 1}</div>
		<div class="white">${table.white}</div>
		<div class="black">${table.black}</div>
		<div class="handicap">${table.handicap}</div>
	</div>
	`
})

newFile += `
</div>
</body>
</html>
`

fs.writeFileSync(argv.output, newFile)
console.log(`Writing output to ${argv.output}.`)

// console.log('data', data);
