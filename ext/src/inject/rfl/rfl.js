

chrome.extension.sendMessage({}, response => {
	var readyStateCheckInterval = setInterval( () => {
		if (document.readyState === "complete") {
			clearInterval(readyStateCheckInterval);

			// ----------------------------------------------------------
			// This part of the script triggers when page is done loading
			console.log("Hello. This message was sent from scripts/inject.js");
			// ----------------------------------------------------------

			// Add an action button to the dom
			const elem = addButtonToDOM('Get IRs status', ['weekly-report-button']);

			// on click get the IRs status information
			elem.addEventListener('click', getIRsStatus);
		}
	}, 10);
});