* TOC
{:toc}

# Fillout API application

## Tech Stack used
- Tested on MacOS Monterey (v12.7.2)
- NodeJS (v21.7.1)
- Node Package Manager (npm v10.5.0)
- ExpressJS(4.16.1) framework

## Run locally
- Rename `sample.env` to `.env` in the root of the project
- Run: `npm install`
- Run: `npm run start`

- For debugging logs, edit `.env` file and set APPLICATION_DEBUG_OPTION to 1

## Testing
### CURL test local API with implemented filters
- Filtering for:
  - "How many employees work under you?" ->
  ```Filter ID:  fFnyxwWa3KV6nBdfBDCHEA
Condition:  less_than
Filter Value:  3```
  - "What is your name?" ->
  ```Filter ID:  bE2Bo4cGUv49cjnqZ4UnkW
Condition:  does_not_equal
Filter Value:  Billy```
- Filter paramaeters(need to be encoded): `[{ "id": "bE2Bo4cGUv49cjnqZ4UnkW", "condition": "does_not_equal", "value": "Billy"},{ "id": "fFnyxwWa3KV6nBdfBDCHEA", "condition": "less_than", "value": "3"}]`

```bash
 curl --header "Content-Type: application/json" \
  --request GET \
    "http://localhost:3000/cLZojxk94ous/filteredResponse?filters=%5B%7B%20%22id%22%3A%20%22bE2Bo4cGUv49cjnqZ4UnkW%22%2C%20%22condition%22%3A%20%22does_not_equal%22%2C%20%22value%22%3A%20%22Billy%22%7D%2C%7B%20%22id%22%3A%20%22fFnyxwWa3KV6nBdfBDCHEA%22%2C%20%22condition%22%3A%20%22less_than%22%2C%20%22value%22%3A%20%223%22%7D%5D"
```

### CURL test Fillout API endpoint
```bash
 curl --header "Content-Type: application/json" \
  --header "Authorization: Bearer sk_prod_TfMbARhdgues5AuIosvvdAC9WsA5kXiZlW8HZPaRDlIbCpSpLsXBeZO7dCVZQwHAY3P4VSBPiiC33poZ1tdUj2ljOzdTCCOSpUZ_3912" \
  --request GET \
  https://api.fillout.com/v1/api/forms/cLZojxk94ous/submissions?limit=1
```

## Project Overview
[Fillout.com](http://Fillout.com) is a powerful form builder, which stores responses to your online form submissions. Create a simple REST API server which interacts with [Fillout.com’s API](https://www.fillout.com/help/fillout-rest-api)  to fetch form responses, but with an option to filter based on certain answers. 

Use the following API key to fetch responses from a demo account Fillout set up: `sk_prod_TfMbARhdgues5AuIosvvdAC9WsA5kXiZlW8HZPaRDlIbCpSpLsXBeZO7dCVZQwHAY3P4VSBPiiC33poZ1tdUj2ljOzdTCCOSpUZ_3912`, with this demo form ID: `cLZojxk94ous`

### Server specifications
Your server only needs to implement one endpoint, for fetching responses from a form, but with filters. Your endpoint should mirror the [existing responses endpoint of Fillout API](https://www.fillout.com/help/fillout-rest-api#d8b24260dddd4aaa955f85e54f4ddb4d), except will have a new parameter for filtering.

#### Request:
- Path: `/{formId}/filteredResponses`
- Method: `GET`
- Query parameters: same as Fillout's [responses endpoint](https://www.fillout.com/help/fillout-rest-api#d8b24260dddd4aaa955f85e54f4ddb4d), except for a new `filters` parameter (JSON stringified):
```tsx
type FilterClauseType = {
	id: string;
	condition: 'equals' | 'does_not_equal' | 'greater_than' | 'less_than';
	value: number | string;
}

// each of these filters should be applied like an AND in a "where" clause
// in SQL
type ResponseFiltersType = ResponseFilter[];
```

**Note:** Fillout forms sometimes have things other than question answers in the responses, but you can assume for this assignment, that the ids to filter by will only ever correspond to form questions, where the values are either `string`, `number`, or strings which are ISO dates


#### Response:
Same response type as the Fillout Rest API Responses endpoint, just filtering out the responses that don’t match the filters.
Note that this means you’ll need to make sure the pagination still works, in the response (i.e. the `totalResponses` and `pageCount` )

### Example:
Given a sample list of responses like this (this response doesn’t match the ones you have on the test account exactly):
```tsx
{
	"responses": [
		{
			"questions": [
				{
					"id": "nameId",
					"name": "What's your name?",
					"type": "ShortAnswer",
					"value": "Timmy"
				},
				{
					"id": "birthdayId",
					"name": "What is your birthday?",
					"type": "DatePicker",
					"value": "2024-02-22T05:01:47.691Z"
				},
			],
			"submissionId": "abc",
			"submissionTime": "2024-05-16T23:20:05.324Z"
			// Include any additional keys
		},
	],
	"totalResponses": 1,
	"pageCount": 1
}
```

#### Input:
```json
[
	{
		id: "nameId",
		condition: "equals",
		value: "Timmy",
	},
	{
		id: "birthdayId",
		condition: "greater_than",
		value: "2024-02-23T05:01:47.691Z"
	}
]
```

#### Output:
No responses are returned, because even though `Timmy` matches the name, but the birthday is not greater than the one in Example filter.
