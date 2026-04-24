var express = require('express');
var router = express.Router();
var MAX_FILL_OUT_PAGE_SIZE = 150;
var DEFAULT_PAGE_SIZE = 50;

// Debuging options
var debug_opt = Number(process.env.APPLICATION_DEBUG_OPTION) === 1 ? 1 : 0; // 1 - for showing console logs, 0 - OFF

router.get('/', function(req, res, next) {
    res.render('index', { title: 'Fillout API application' });
});

const handleFilteredResponses = async function(req, res) {
    // Debug logging
    if (debug_opt == 1) console.log("DEBUG log all params: ", req.params);
    if (debug_opt == 1) console.log("DEBUG log all queries: ", req.query);
    if (debug_opt == 1) console.log("DEBUG log formId: " + req.params.formId);
    if (debug_opt == 1) console.log("DEBUG log .env file API key: " + process.env.FILLOUT_API_KEY);

    // Parsing out filters from the request
    var parsedFilters = null;
    if (req.query.filters) {
        try {
            parsedFilters = JSON.parse(req.query.filters);
        } catch (error) {
            return res.status(400).json({ error: 'Invalid filters JSON' });
        }

        if (!Array.isArray(parsedFilters)) {
            return res.status(400).json({ error: 'Invalid filters JSON' });
        }
    }
    if (debug_opt == 1 && parsedFilters) console.log("DEBUG filters if exist:  ", parsedFilters);

    try {
        if (!parsedFilters || parsedFilters.length === 0) {
            var unfilteredResult = await fetchFilloutPage(req.params.formId, req.query);

            if (!unfilteredResult.ok) {
                return proxyFilloutError(res, unfilteredResult);
            }

            return res.status(unfilteredResult.status).json(unfilteredResult.data);
        }

        var paginatedResponses = await fetchAllMatchingResponses(req.params.formId, req.query);
        if (!paginatedResponses.ok) {
            return proxyFilloutError(res, paginatedResponses);
        }

        var filteredResponses = filterResponses(paginatedResponses.data, parsedFilters, req.query);
        return res.json(filteredResponses);
    } catch (error) {
        console.error('Error retrieving data:', error);
        return res.status(500).send('Error retrieving data');
    }
};

router.get('/:formId/filteredResponses', handleFilteredResponses);
router.get('/:formId/filteredResponse', handleFilteredResponses);

// Logic for filtering
const filterResponses = (responses, filters, query) => {
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

    var pagination = getPagination(query);
    var paginatedEntries = filteredEntries.slice(pagination.offset, pagination.offset + pagination.limit);

    return {
        ...responses,
        responses: paginatedEntries,
        totalResponses: filteredEntries.length,
        pageCount: filteredEntries.length === 0 ? 0 : Math.ceil(filteredEntries.length / pagination.limit)
    };
};

const fetchAllMatchingResponses = async (formId, query) => {
    var offset = 0;
    var allResponses = [];
    var totalResponses = 0;

    while (true) {
        var pageResult = await fetchFilloutPage(formId, query, {
            limit: String(MAX_FILL_OUT_PAGE_SIZE),
            offset: String(offset)
        }, ['filters', 'limit', 'offset']);

        if (!pageResult.ok) {
            return pageResult;
        }

        var pageData = pageResult.data;
        totalResponses = pageData.totalResponses;
        allResponses = allResponses.concat(pageData.responses);

        if (allResponses.length >= totalResponses || pageData.responses.length === 0) {
            return {
                ok: true,
                status: pageResult.status,
                data: {
                    ...pageData,
                    responses: allResponses,
                    totalResponses: allResponses.length,
                    pageCount: allResponses.length === 0 ? 0 : 1
                }
            };
        }

        offset += MAX_FILL_OUT_PAGE_SIZE;
    }
};

const fetchFilloutPage = async (formId, query, overrides, excludedKeys) => {
    var filloutApiUrl = buildFilloutApiUrl(formId, query, overrides, excludedKeys);
    if (debug_opt == 1) console.log("DEBUG Final Fillout API URL: " + filloutApiUrl);

    var response = await fetch(filloutApiUrl, {
        headers: {
            'Authorization': 'Bearer ' + process.env.FILLOUT_API_KEY
        }
    });

    var data = await response.json();

    return {
        ok: response.ok,
        status: response.status,
        data: data
    };
};

const buildFilloutApiUrl = (formId, query, overrides, excludedKeys) => {
    var filloutApiUrl = process.env.FILLOUT_API_URL + process.env.FILLOUT_API_V1_FORMS + formId + process.env.FILLOUT_API_V1_SUBMISSIONS;
    if (debug_opt == 1) console.log("DEBUG Fillout API base URL: " + filloutApiUrl);

    var searchParams = buildQueryString(query, overrides, excludedKeys);
    if (debug_opt == 1 && searchParams) console.log("DEBUG queries passed: " + searchParams);

    return searchParams ? filloutApiUrl + '?' + searchParams : filloutApiUrl;
};

const buildQueryString = (query, overrides, excludedKeys) => {
    var excluded = new Set(excludedKeys || ['filters']);

    var queryParts = Object.keys(query || {}).reduce(function(result, key) {
        if (excluded.has(key) || query[key] === undefined) {
            return result;
        }

        result.push(encodeURIComponent(key) + '=' + encodeURIComponent(query[key]));
        return result;
    }, []);

    var overrideParts = Object.keys(overrides || {}).reduce(function(result, key) {
        if (overrides[key] === undefined) {
            return result;
        }

        result.push(encodeURIComponent(key) + '=' + encodeURIComponent(overrides[key]));
        return result;
    }, []);

    return queryParts.concat(overrideParts).join('&');
};

const getPagination = (query) => {
    var parsedLimit = Number.parseInt(query && query.limit, 10);
    var parsedOffset = Number.parseInt(query && query.offset, 10);

    return {
        limit: Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_PAGE_SIZE,
        offset: Number.isInteger(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0
    };
};

const proxyFilloutError = (res, result) => {
    return res.status(result.status).json(result.data);
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
module.exports.fetchAllMatchingResponses = fetchAllMatchingResponses;
module.exports.buildFilloutApiUrl = buildFilloutApiUrl;
