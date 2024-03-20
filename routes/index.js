var express = require('express');
var router = express.Router();

// Debuging options
var debug_opt = 0; // 1 - for showing console logs, 0 - OFF

router.get('/', function(req, res, next) {
    res.render('index', { title: 'Fillout API application' });
});

router.get('/:formId/filteredResponse', function(req, res) {
    // Debug logging
    if (debug_opt == 1) console.log("DEBUG log all params: ", req.params);
    if (debug_opt == 1) console.log("DEBUG log all queries: ", req.query);
    if (debug_opt == 1) console.log("DEBUG log formId: " + req.params.formId);
    if (debug_opt == 1) console.log("DEBUG log .env file API key: " + process.env.FILLOUT_API_KEY);

    // Fillout API URL
    var filloutApiUrl = process.env.FILLOUT_API_URL + process.env.FILLOUT_API_V1_FORMS + req.params.formId + process.env.FILLOUT_API_V1_SUBMISSIONS;
    if (debug_opt == 1) console.log("DEBUG Fillout API base URL: " + filloutApiUrl);

    // Queries passed further to API
    var queries = [];
    Object.keys(req.query).forEach(function(key){
        if(key != 'filters'){
            queries.push(encodeURIComponent(key) + '=' + encodeURIComponent(req.query[key]));
        }
    });
    queries = queries.join('&');
    if (debug_opt == 1 && queries) console.log("DEBUG queries passed: " + queries);

    queries ? filloutApiUrl += '?' + queries : '';
    if (debug_opt == 1) console.log("DEBUG Final Fillout API URL: " + filloutApiUrl);

    // Parsing out filters from the request
    var parsedFilters = req.query.filters ? JSON.parse(req.query.filters) : '';
    if (debug_opt == 1 && parsedFilters) console.log("DEBUG filters if exist:  ", parsedFilters);

    // Fetching submissions from Fillout API
    fetch(filloutApiUrl, {
        headers: {
            'Authorization': 'Bearer '+process.env.FILLOUT_API_KEY
        }
    })
    .then(response => response.json())
    .then(data => {
        if(parsedFilters && parsedFilters != ''){
            var filteredResponses = filterResponses(data, parsedFilters);
            res.json(filteredResponses);
        }else{
            res.json(data);
        }
    })
    .catch(error => {
        console.error('Error retrieving data:', error);
        res.status(500).send('Error retrieving data');
    });
});

// Logic for filtering
const filterResponses = (responses, filters) => {
    return responses.responses.filter((response) => {
        if (debug_opt == 1) console.log("DEBUG Single response being tested against filter:\n", response);
        let flagged = true;
        filters.forEach((filter) => {
            if (flagged == false) return false;
            const question = response.questions.find((q) => q.id === filter.id);
            if (!question) return false;
            if (debug_opt == 1) console.log('DEBUG Question/Filter ID: ', question.id, '/',filter.id, '\nDEBUG Condition: ',filter.condition,'\nDEBUG Question/Filter Value: ', question.value, '/',filter.value, '\n');
            switch (filter.condition) {
                case 'equals':
                    flagged = question.value == filter.value;
                    return flagged;
                case 'does_not_equal':
                    flagged = question.value != filter.value;
                    return flagged;
                case 'greater_than':
                    flagged = question.value > filter.value;
                    return flagged;
                case 'less_than':
                    flagged = question.value < filter.value;
                    return flagged;
                default:
                    return false;
            }
        });
        return flagged;
    });
};

// Start the ExpressJS server
module.exports = router;
