const assert = require('node:assert/strict');
const test = require('node:test');

const routeModule = require('../routes/index');
const {
  areEqualValues,
  compareValues,
  filterResponses,
  handleFilteredResponses,
} = routeModule;

process.env.FILLOUT_API_URL = process.env.FILLOUT_API_URL || 'https://api.fillout.com';
process.env.FILLOUT_API_V1_FORMS = process.env.FILLOUT_API_V1_FORMS || '/v1/api/forms/';
process.env.FILLOUT_API_V1_SUBMISSIONS = process.env.FILLOUT_API_V1_SUBMISSIONS || '/submissions';
process.env.FILLOUT_API_KEY = process.env.FILLOUT_API_KEY || 'test-api-key';

const originalFetch = global.fetch;

const sampleResponses = {
  responses: [
    {
      submissionId: 'johnny-submission',
      questions: [
        { id: 'nameId', value: 'Johnny' },
        { id: 'employeeCount', value: 2 },
        { id: 'birthdayId', value: '2024-02-01T00:00:00.000Z' },
      ],
    },
    {
      submissionId: 'null-name-submission',
      questions: [
        { id: 'nameId', value: null },
        { id: 'employeeCount', value: null },
        { id: 'birthdayId', value: null },
      ],
    },
    {
      submissionId: 'manager-submission',
      questions: [
        { id: 'nameId', value: 'Billy' },
        { id: 'employeeCount', value: '10' },
        { id: 'birthdayId', value: '2024-03-01T00:00:00.000Z' },
      ],
    },
  ],
  totalResponses: 3,
  pageCount: 3,
};

const invokeHandler = async (query) => {
  return new Promise((resolve, reject) => {
    const req = {
      params: { formId: 'demo-form' },
      query,
    };
    const res = {
      statusCode: 200,
      headers: {},
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        resolve({
          statusCode: this.statusCode,
          payload,
        });
      },
      send(payload) {
        resolve({
          statusCode: this.statusCode,
          payload,
        });
      },
    };

    Promise.resolve(handleFilteredResponses(req, res)).catch(reject);
  });
};

test.afterEach(() => {
  global.fetch = originalFetch;
});

test('areEqualValues avoids null/string coercion', () => {
  assert.equal(areEqualValues(null, 'Johnny'), false);
  assert.equal(areEqualValues(null, null), true);
  assert.equal(areEqualValues('2', 2), true);
});

test('compareValues handles numbers and ISO dates', () => {
  assert.equal(compareValues('10', 2), 1);
  assert.equal(compareValues('2024-03-01T00:00:00.000Z', '2024-02-01T00:00:00.000Z'), 1);
  assert.equal(compareValues(null, '2024-02-01T00:00:00.000Z'), null);
});

test('filterResponses applies all filters with AND semantics and updates the envelope', () => {
  const filtered = filterResponses(sampleResponses, [
    { id: 'nameId', condition: 'does_not_equal', value: 'Billy' },
    { id: 'employeeCount', condition: 'less_than', value: '3' },
  ], {});

  assert.equal(filtered.totalResponses, 1);
  assert.equal(filtered.pageCount, 1);
  assert.deepEqual(
    filtered.responses.map((response) => response.submissionId),
    ['johnny-submission']
  );
});

test('the router registers the plural filteredResponses endpoint from the assignment', () => {
  const routePaths = routeModule.stack
    .filter((layer) => layer.route)
    .map((layer) => layer.route.path);

  assert.ok(routePaths.includes('/:formId/filteredResponses'));
});

test('GET /:formId/filteredResponses fetches all upstream matches before applying local pagination', async () => {
  const capturedUrls = [];
  let capturedHeaders;

  global.fetch = async (url, options) => {
    capturedUrls.push(url);
    capturedHeaders = options.headers;

    return {
      ok: true,
      status: 200,
      json: async () => sampleResponses,
    };
  };

  const response = await invokeHandler({
    limit: '1',
    offset: '1',
    afterDate: '2024-01-01',
    filters: JSON.stringify([{ id: 'nameId', condition: 'does_not_equal', value: 'Billy' }]),
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(capturedUrls, [
    `${process.env.FILLOUT_API_URL}${process.env.FILLOUT_API_V1_FORMS}demo-form${process.env.FILLOUT_API_V1_SUBMISSIONS}?afterDate=2024-01-01&limit=150&offset=0`,
  ]);
  assert.equal(capturedHeaders.Authorization, `Bearer ${process.env.FILLOUT_API_KEY}`);
  assert.equal(response.payload.totalResponses, 2);
  assert.equal(response.payload.pageCount, 2);
  assert.deepEqual(
    response.payload.responses.map((entry) => entry.submissionId),
    ['null-name-submission']
  );
});

test('GET /:formId/filteredResponses returns 400 for invalid filters JSON', async () => {
  global.fetch = async () => {
    throw new Error('fetch should not be called for invalid filters');
  };

  const response = await invokeHandler({
    filters: 'not-json',
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.payload, { error: 'Invalid filters JSON' });
});

test('GET /:formId/filteredResponses returns 400 when filters is valid JSON but not an array', async () => {
  global.fetch = async () => {
    throw new Error('fetch should not be called for invalid filters');
  };

  const response = await invokeHandler({
    filters: JSON.stringify({ id: 'nameId', condition: 'equals', value: 'Johnny' }),
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.payload, { error: 'Invalid filters JSON' });
});

test('GET /:formId/filteredResponses returns the upstream payload unchanged when no filters are provided', async () => {
  global.fetch = async () => {
    return {
      ok: true,
      status: 200,
      json: async () => sampleResponses,
    };
  };

  const response = await invokeHandler({});

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.payload, sampleResponses);
});

test('GET /:formId/filteredResponses mirrors upstream error responses when no filters are provided', async () => {
  global.fetch = async () => {
    return {
      ok: false,
      status: 401,
      json: async () => ({ message: 'Unauthorized' }),
    };
  };

  const response = await invokeHandler({
    limit: '1',
  });

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.payload, { message: 'Unauthorized' });
});
