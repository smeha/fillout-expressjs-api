var express = require('express');
var router = express.Router();

// Debuging options
var debug_opt = Number(process.env.APPLICATION_DEBUG_OPTION) === 1 ? 1 : 0; // 1 - for showing console logs, 0 - OFF

router.get('/', function(req, res, next) {
    res.render('index', { title: 'Fillout API application' });
});

const handleFilteredResponses = function(req, res) {
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
};

router.get('/:formId/filteredResponses', handleFilteredResponses);
router.get('/:formId/filteredResponse', handleFilteredResponses);

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
                    return areEqualValues(question.value, filter.value);
                case 'does_not_equal':
                    return !areEqualValues(question.value, filter.value);
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

const areEqualValues = (leftValue, rightValue) => {
    if (leftValue === null || leftValue === undefined || rightValue === null || rightValue === undefined) {
        return leftValue === rightValue;
    }

    var comparisonOperands = normalizeComparisonOperands(leftValue, rightValue);
    return comparisonOperands.left === comparisonOperands.right;
};

const compareValues = (leftValue, rightValue) => {
    if (leftValue === null || leftValue === undefined || rightValue === null || rightValue === undefined) {
        return null;
    }

    var comparisonOperands = normalizeComparisonOperands(leftValue, rightValue);
    var leftComparable = comparisonOperands.left;
    var rightComparable = comparisonOperands.right;

    if (leftComparable < rightComparable) {
        return -1;
    }

    if (leftComparable > rightComparable) {
        return 1;
    }

    return 0;
};

const normalizeComparisonOperands = (leftValue, rightValue) => {
    if (isFiniteNumberValue(leftValue) && isFiniteNumberValue(rightValue)) {
        return {
            left: Number(leftValue),
            right: Number(rightValue)
        };
    }

    if (isDateValue(leftValue) && isDateValue(rightValue)) {
        return {
            left: Date.parse(leftValue),
            right: Date.parse(rightValue)
        };
    }

    return {
        left: String(leftValue),
        right: String(rightValue)
    };
};

const isFiniteNumberValue = (value) => {
    if (typeof value === 'number') {
        return Number.isFinite(value);
    }

    if (typeof value !== 'string') {
        return false;
    }

    var trimmedValue = value.trim();
    return trimmedValue !== '' && Number.isFinite(Number(trimmedValue));
};

const isDateValue = (value) => {
    return typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Date.parse(value));
};

// Start the ExpressJS server
module.exports = router;
module.exports.filterResponses = filterResponses;
module.exports.compareValues = compareValues;
module.exports.areEqualValues = areEqualValues;
module.exports.handleFilteredResponses = handleFilteredResponses;
