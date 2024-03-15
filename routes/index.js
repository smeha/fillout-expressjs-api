const express = require('express');
const router = express.Router();

router.get('/', function(req, res, next) {
    res.render('index', { title: 'Fillout API application' });
});

// The endpoint for API
router.get('/:formId/filteredResponses', (req, res) => {
  const formId = req.params.formId;
  const filters = JSON.parse(req.query.filters);


  // Filtered responses
  res.json(filteredResponses);
});

// Start the ExpressJS server
module.exports = router;
