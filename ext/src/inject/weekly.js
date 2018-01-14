

	const JIRA_ENDPOINT = 'http://vm105-56sim:8080/rest/api/2/';
	const REDMINE_ENDPOINT = 'http://redminesim:8080/redmine/projects/process-app-development/wiki/';

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

	function fetchIRs(owners, states, severities) {
		'use strict';
		// query param docs: https://dsxdev-online.dsone.3ds.com/enovia/rest/application.wadl.xml#idm214143804
		var ownersParams = (owners || ['rqs']).map((o) => {
				return 'Owner=' + o;
		});
		var statesParams = (states || ['Need Clarification', 'Opened', 'Technical Analysis', 'Under Correction', 'In Departmental Integration', 'Final Validation']).map((s) => {
				return 'State=' + s;
		});
		var severitiesParams = (severities || []).map((s) => {
				return 'Severity=' + s;
		});

		var params = [].concat(ownersParams, statesParams, severitiesParams).join('&');

		return fetch('https://dsxdev-online.dsone.3ds.com/enovia/rest/irs?' + params, {
				credentials: 'include',
				headers: new Headers({
						'Accept': 'application/json'
				})
		}).then(res => {
				return res.json().then(j => {
								var timestampToDays = (ts) => {
										return Math.ceil((new Date() - new Date(ts)) / (24 * 3600 * 1000));
								};
								var incidents = j || [];
								var escapeText = (text) => {
										return (text || '').replace(/\|/g, '|').replace(/\n+/g, '\n');
								};
								var compareFlag = (a, b) => {
										var flags = ['Normal', 'Must Fix', 'Mandatory', 'Critsit', 'HMA', 'Show Stopper'];
										return flags.indexOf(b) - flags.indexOf(a);
								};
								incidents.sort((a, b) => {
										return a.ecoType.value.localeCompare(b.ecoType.value) || a.severity - b.severity || compareFlag(a.hmaflag.value, b.hmaflag.value) || a.name.localeCompare(b.name);
								});

								return incidents.map((row) => {
										var flags = (row.hmaflag.value !== 'Normal' ? row.hmaflag.value : '');
										// Regression?
										flags += (row.regression? ' REG' : '');
										// Core dump?
										flags += (row.dsdcOpenerSymptom === 'coreDump'? ' CD' : '');
										flags = flags.trim();
										return {
												name: row.name,
												url: 'https://dsxdev-online.dsone.3ds.com/enovia/common/emxNavigator.jsp?objectId=' + row.id,
												type: row.ecoType.value,
												state: row.state,
												severity: row.severity,
												owner: row.owner,
												creator: row.originator,
												description: escapeText(row.description),
												flag: flags,
												TATPos: timestampToDays(row.tatPosStart),
												TATRef: timestampToDays(row.tatRefStart),
												TD: timestampToDays(row.targetDate) || null,
												notes: escapeText(row.notepad),
												hmaExecComment: row.hmaExecComment,
												level: row.targetLevelName
										};
								});
						},
						(err) => { console.error('Failed to parse IR list: ' + err); throw err;})
		}, (err) => { console.error('Failed to list IRs: ' + err); throw err;})
	}
	
	function logMessage (message, data) {
		console.log(`%c${message}`, 'background-color: blue; color: white; font-size: x-large', data);
	}

	function errorMessage (message, data) {
		console.log(`%c${message}`, 'background-color: red; color: white; font-size: x-large', data);
	}

	// optional argument
	async function getProgress() {
		const issuesToWiki = issue => {
			return `** ${issue.fields.summary} - ${issue.fields.status.name}`;
		};

		const getIssues = async project => {			
			let resp = await fetch(`${JIRA_ENDPOINT}search?jql=Sprint in openSprints() and Project=${project}`,
									{
										credentials: 'include'
									}).then(res => res.json());

			// Get all the progress in the format for wiki
			return resp.issues.map(issuesToWiki);
		};

		// Get the progress in the sprint for each app
		const ps = (await getIssues('ps')).join('\n');
		const xs = (await getIssues('xs')).join('\n');

		const weekly_progress = {ps, xs};
    
    // Save it using the Chrome extension storage API.
    chrome.storage.sync.set({weekly_progress}, () => {
			logMessage('Weekly progress stored successfully:', weekly_progress);
			alert('Successfully fetched weekly progress');
		});
	}


	async function getIRsStatus() {
		let teams = {
      ps: 'wn1,ami9,jmi4,rsh5'.split(','),
      xs: 'zb8,apk2,c4q,aan14'.split(',')
    }
    let objectives = {
      ps: {
                extsev1over60count: 0,
                extsev1count: 1,
                extcount: 5,
                int17xmhalcount: 0,
                int17xsev1count:8,
                int18xcount: 60
      },
      xs: {
                extsev1over60count: 0,
                extsev1count: 0,
                extcount: 3,
                int17xmhalcount: 0,
                int17xsev1count:8,
                int18xcount: 50
      }
		};
		
		const getData = async teamName => {
			return new Promise(async resolve => {
				var irOwners = teams[teamName];
				var irLimit = 10;
				var showHma = false;
				var states = ['Need Clarification', 'Opened', 'Technical Analysis', 'Under Correction', 'Final Validation'];
	
				if (irOwners && irOwners.length > 0){
						const irsp = await fetchIRs(irOwners, states);
						var counts = {
								extsev1over60count: 0,
								extsev1over60idicount: 0,
								extsev1count: 0,
								extsev1idicount: 0,
								extcount: 0,
								extidicount: 0,
								int17xmhalcount: 0,
								int17xmhalidicount: 0,
								int17xsev1count:0,
								int17xsev1idicount:0,
								int18xcount: 0,
								int18xidicount: 0,
								intcount: 0,
								intidicount: 0
						};
						var critsits = [];
						var mhals = [];
						var over60 = [];
						var soonOver60 = [];
						var overTd = [];
						var soonOverTd = [];
	
						irsp.forEach((ir) => {
							var isExt = (incident) => {return incident.type === 'External' || incident.type === 'HotFix'; };
							var isSev1 = (incident) => {return incident.severity === 1};
							var isHma = (incident) => {
								// Mandatory, Must Fix Reg, Must Fix Non Reg, Sev1 Reg Int, Sev1 CD Int
								// http://dsdoc/devdoc/3DEXPERIENCER2018x/en/DSInternalDoc.htm?show=English/ProDsxDevBI/uni_ASLhKyOa7hNHppz7EU7Xny4.htm
								var flag = incident.flag.toLowerCase();
								var isMand = flag.includes('mandatory');
								var isMust = flag.includes('must fix');
								var isSev1Reg = isSev1(incident) && flag.includes('reg');
								var isSev1Cd = isSev1(incident) && flag.includes('cd');
	
								return (isMand || isMust || isSev1Reg || isSev1Cd );
							};
							var isCrit = (incident) => {return incident.flag.toLowerCase().includes('critsit')};
							var isOver60TATRef = (incident) => {return incident.TATRef >= 60};
							var isSoonOver60TATRef = (incident) => {return incident.TATRef > 50 && incident.TATRef < 60};
							var isOverTD = (incident) => {return incident.TD !== null && incident.TD >= 0};
							var isSoonOverTD = (incident) => {return incident.TD !== null && incident.TD > -10 && incident.TD < 0};
							var isLevel = (incident, level) => {return incident.level === level};
							var isIDI = (incident) => {return incident.state === 'In Departmental Integration'};
	
							if (isCrit(ir)) {
								critsits.push(ir);
							}
							if (isOverTD(ir)) {
								overTd.push(ir);
							}
							if (isSoonOverTD(ir)) {
								soonOverTd.push(ir);
							}
							if (isExt(ir)) {
								counts.extcount++;
								if (isIDI(ir)) {counts.extidicount++;}
								if (isSev1(ir)) {
										counts.extsev1count++;
										if (isIDI(ir)) {counts.extsev1idicount++;}
										if (isOver60TATRef(ir)) {
												counts.extsev1over60count++;
												if (isIDI(ir)) {counts.extsev1over60idicount++;}
												over60.push(ir);
										}
										if (isSoonOver60TATRef(ir)) {
												soonOver60.push(ir);
										}
								}
							} else {
								counts.intcount++;
								if (isIDI(ir)) {counts.intidicount++;}
								if (isSev1(ir) && (isLevel(ir, '3DEXPERIENCER2017x') || isLevel(ir, 'Isight-SEE2017'))) {
										counts.int17xsev1count++;
										if (isIDI(ir)) {counts.int17xsev1idicount++;}
								}
								if (isHma(ir) && (isLevel(ir, '3DEXPERIENCER2017x') || isLevel(ir, 'Isight-SEE2017'))) {
										counts.int17xmhalcount++;
										if (isIDI(ir)) {counts.int17xmhalidicount++;}
										mhals.push(ir);
								}
								if (isLevel(ir, '3DEXPERIENCER2018x') || isLevel(ir, 'Isight-SEE2018')) {
										counts.int18xcount++;
										if (isIDI(ir)) {counts.int18xidicount++;}
								}
							}
						});
	
						var mapIrToWiki = (ir) => {
								var hmaNoteTowikiXslt = `<?xml version="1.0"?>
	<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
	<xsl:output method="text"/>
	<xsl:template match="entry">
	**** *HMA Note*: <xsl:value-of select="." /> (Action _<xsl:value-of select="@action" />_ from _<xsl:value-of select="@user" />_ on <xsl:value-of select="@date" />)</xsl:template>
	</xsl:stylesheet>`;
								var xsltProcessor, xsltOutput, execText = '';
								if (showHma && ir.hmaExecComment && ir.hmaExecComment.startsWith('<')) {
										try {
											xsltProcessor = new XSLTProcessor();
											xsltProcessor.importStylesheet((new DOMParser()).parseFromString(hmaNoteTowikiXslt, 'text/xml'));
											xsltOutput = xsltProcessor.transformToDocument((new DOMParser()).parseFromString(ir.hmaExecComment, 'text/xml'));
											execText = xsltOutput.documentElement.textContent.replace(/\n+/g , '\n').slice(0, -1);
										} catch (e) {
											console.warn('Error parsing hmaNote for ', ir, e);
											execText = '';
										}
								}
								var TD = (ir.TD !== null) ? ', TD ' + (ir.TD > 0 ? 'overdue by ' : 'due in ' ) + Math.abs(ir.TD) + ' day'+ (Math.abs(ir.TD) > 1? 's' : '') : '';
								return  '\n*** "' + ir.name + '":' + ir.url + ' - ' + ir.description + (ir.description.endsWith('.') ? '' : '.') + ' ' + ir.state + ' (TAT ' + ir.TATRef + ' day' + (ir.TATRef > 1 ? 's' : '') + TD + ')' + execText;
						};
	
						// Sample expected output:
						// P&G. IR-123456 – Pop-up doesn’t close automatically. UC. Not critical. Requested console output.
						var wikiCrit = critsits.map(mapIrToWiki).join('') || 'None';
						var wikiOver60 = over60.length > 0 && over60.length <= irLimit ? '\n{{collapse' + over60.map(mapIrToWiki).join('') + '\n}}': '';
						var wikiSoonOver60 = soonOver60.length > 0 && soonOver60.length ? soonOver60.map(mapIrToWiki).join(''): '';
						var wikiOverTd = overTd.length > 0 && overTd.length ? overTd.map(mapIrToWiki).join(''): '';
						var wikiSoonOverTd = soonOverTd.length > 0 && soonOverTd.length ? soonOverTd.map(mapIrToWiki).join(''): '';
						var wikiMhal = mhals.length > 0 && mhals.length <= irLimit ? '\n{{collapse' + mhals.map(mapIrToWiki).join('') + '\n}}': '';
	
						var targets = objectives[teamName] || {};
						Object.keys(targets).forEach((target) => { targets[target] = ', target ' + targets[target];});
						Object.keys(counts).forEach((target) => { targets[target] =  targets[target] || ''});
	
						var wikiText = `* IRs
** CRITSITs:${wikiCrit}
** External old Sev.1 count: ${counts.extsev1over60count} (${counts.extsev1over60idicount} in IDI${targets.extsev1over60count})${wikiOver60}
** External Sev.1 count: ${counts.extsev1count} (${counts.extsev1idicount} in IDI${targets.extsev1count})
** Total External count: ${counts.extcount} (${counts.extidicount} in IDI${targets.extcount})
** Internal MHAL 2017x count: ${counts.int17xmhalcount} (${counts.int17xmhalidicount} in IDI${targets.int17xmhalcount})${wikiMhal}
** Internal Sev.1 2017x count: ${counts.int17xsev1count} (${counts.int17xsev1idicount} in IDI${targets.int17xsev1count})
** Total internal 2018x count: ${counts.int18xcount} (${counts.int18xidicount} in IDI${targets.int18xcount})
** Total internal count: ${counts.intcount} (${counts.intidicount} in IDI)`;};

			resolve(wikiText);
		});};

		const ps = await getData('ps');
		const xs = await getData('xs');
		let weekly_irstatus = {ps, xs};
		
		// Save it using the Chrome extension storage API.
		chrome.storage.sync.set({weekly_irstatus}, () => {			
			logMessage('Weekly progress stored successfully:', weekly_irstatus);
			alert('Successfully fetched weekly ir status');
		});
	}

	function getDataFromStorage(key) {
		return new Promise(resolve => {
			chrome.storage.sync.get(key, res => resolve(res[key]));
		});
	}

	async function pasteReport() {
		const date = new Date(Date.now());
		const year = date.getFullYear().toString().replace(/\d\d/, '');
		// adjust the week
		let week = date.getWeek();
		// if its monday or tuesday then we are preparing the report for previous week
		week = date.getDay() <= 2 ? week - 1: week;
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

		// Get the data from storage
		const weekly_progress = await getDataFromStorage('weekly_progress');
		const weekly_irstatus = await getDataFromStorage('weekly_irstatus');

		const HEADING = {
			xs: 'Process Experience Studio',
			ps: 'Performance Study'
		};


		const buildReport = (app) => {
			return `h2. ${HEADING[app]}
			
${priorities[app]}

${weekly_irstatus[app]}

* Progresses of the past week
${weekly_progress[app]}`;
		};

			

		// get the editable textbox
		const contentText = document.getElementById('content_text');											
		const context = contentText.value.search(/^h2\. Process Experience Studio/);

		// if context matches then its XS else PS
		contentText.value = context === 0 ? buildReport('xs') : buildReport('ps');		
		
	}




	function addButtonToDOM(title, classlist) {
		const elem = document.createElement('button');
		elem.innerHTML = title;
		classlist.map(item => {
			elem.classList.add(item);
		});		
		document.body.appendChild(elem);

		return elem;
	}

