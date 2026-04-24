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
    var parsedFilters = '';
    if (req.query.filters) {
        try {
            parsedFilters = JSON.parse(req.query.filters);
        } catch (error) {
            return res.status(400).json({ error: 'Invalid filters JSON' });
        }
    }
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
    var filteredEntries = responses.responses.filter((response) => {
        if (debug_opt == 1) console.log("DEBUG Single response being tested against filter:\n", response);
        return filters.every((filter) => {
            const question = response.questions.find((q) => q.id === filter.id);
            if (!question) {
                return false;
            }

            if (debug_opt == 1) console.log('DEBUG Question/Filter ID: ', question.id, '/',filter.id, '\nDEBUG Condition: ',filter.condition,'\nDEBUG Question/Filter Value: ', question.value, '/',filter.value, '\n');
            switch (filter.condition) {
                case 'equals':
                    return compareValues(question.value, filter.value) === 0;
                case 'does_not_equal':
                    return compareValues(question.value, filter.value) !== 0;
                case 'greater_than':
                    return compareValues(question.value, filter.value) > 0;
                case 'less_than':
                    return compareValues(question.value, filter.value) < 0;
                default:
                    return false;
            }
        });
    });

    return {
        ...responses,
        responses: filteredEntries,
        totalResponses: filteredEntries.length,
        pageCount: filteredEntries.length
    };
};

const compareValues = (leftValue, rightValue) => {
    var leftComparable = normalizeComparableValue(leftValue);
    var rightComparable = normalizeComparableValue(rightValue);

    if (leftComparable < rightComparable) {
        return -1;
    }

    if (leftComparable > rightComparable) {
        return 1;
    }

    return 0;
};

const normalizeComparableValue = (value) => {
    if (typeof value === 'number') {
        return value;
    }

    if (typeof value !== 'string') {
        return value;
    }

    var trimmedValue = value.trim();
    if (trimmedValue !== '' && Number.isFinite(Number(trimmedValue))) {
        return Number(trimmedValue);
    }

    var parsedDate = Date.parse(trimmedValue);
    if (!Number.isNaN(parsedDate)) {
        return parsedDate;
    }

    return trimmedValue;
};

// Start the ExpressJS server
module.exports = router;
