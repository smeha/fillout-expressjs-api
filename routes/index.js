var express = require('express');
var router = express.Router();

router.get('/', function(req, res, next) {
    res.render('index', { title: 'Fillout API application' });
});

router.get('/:formId/filteredResponse', function(req, res) {
    // TEST render all params
    res.send(req.params);
    // TEST get formId
    console.log(req.params.formId);
    // TEST .env file
    console.log(process.env.FILLOUT_API_KEY);

    // TO DO
    // const formId = req.params.formId;
    // const filters = JSON.parse(req.query.filters);

    // // Filtered responses
    // res.json(filteredResponses);
});

// Start the ExpressJS server
module.exports = router;
