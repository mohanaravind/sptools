// if you checked "fancy-settings" in extensionizr.com, uncomment this lines

// var settings = new Store("settings", {
//     "sample_setting": "This is how you use Store.js to remember values"
// });

(function () {
	Date.prototype.getWeek = function() {
		var date = new Date(this.getTime());
		date.setHours(0, 0, 0, 0);
		// Thursday in current week decides the year.
		date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
		// January 4 is always in week 1.
		var week1 = new Date(date.getFullYear(), 0, 4);
		// Adjust to Thursday in week 1 and count number of weeks from date to week1.
		return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000
							- 3 + (week1.getDay() + 6) % 7) / 7);
	}

	// Returns the four-digit year corresponding to the ISO week of the date.
	Date.prototype.getWeekYear = function() {
		var date = new Date(this.getTime());
		date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
		return date.getFullYear();
	}


	const JIRA_ENDPOINT = 'http://vm105-56sim:8080/rest/api/2/';
	const REDMINE_ENDPOINT = 'http://redminesim:8080/redmine/projects/process-app-development/wiki/';

	// optional argument
	async function getProgress(sprint) {
		// if specific sprint is passed gets its progress else get the latest
		sprint = sprint ? `=${sprint}` : ' in openSprints()';

		const issuesToWiki = issue => {
			return `** ${issue.fields.summary} - ${issue.fields.status.name}`;
		};

		const getIssues = async project => {			
			let resp = await fetch(`${JIRA_ENDPOINT}search?jql=Sprint${sprint} and Project=${project}`,
									{
										credentials: 'include'
									}).then(res => res.json());

			// Get all the progress in the format for wiki
			return resp.issues.map(issuesToWiki);
		};

		// Get the progress in the sprint for each app
		const ps = await getIssues('ps');
		const xs = await getIssues('xs');

		const issues = {ps, xs};
		

		console.info(issues);
	}

	async function getPriorities(week) {
		const date = new Date(Date.now());
		const year = date.getFullYear().toString().replace(/\d\d/, '');
		// adjust the week
		week = week.toString().length === 1 ? '0' + week : week;
		
		const resp = await fetch(`${REDMINE_ENDPOINT}Status${year}Wk${week}.json`, 
									{
										headers: new Headers({
              								'Accept': 'application/json',
              								'X-Redmine-API-Key': '644bb91674f2afe28ad48c6f85564442adc66ff6' 
										})
          							}).then(res => res.json());

		// Get the priorities
		const ps = resp.wiki_page.text.split('h2. Performance Study')[1]
									  .split('h2. Infrastructure')[0].split('* IRs')[0];

		const xs = resp.wiki_page.text.split('h2. Process Experience Studio')[1]
									  .split('h2. Infrastructure')[0].split('* IRs')[0];

		const priorities = {ps, xs};

		console.info(priorities);
	}


// Dec2017-Sprint-2

	// getProgress();
	
// 	let week = date.getWeek().toString();
// 	week = week.length === 1 ? '0' + week : week;
// date.getDay() >= 5

// 	getPriorities(02);

}())


//example of using a message handler from the inject scripts
chrome.extension.onMessage.addListener(
  function(request, sender, sendResponse) {
  	chrome.pageAction.show(sender.tab.id);
    sendResponse();
    getProgress();
  });