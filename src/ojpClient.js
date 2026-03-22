const { XMLParser } = require('fast-xml-parser');

const OJP_API_URL = 'https://api.opentransportdata.swiss/ojp20';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  isArray: (name) => {
    // These elements should always be arrays even when there's only one
    const arrayElements = [
      'StopEventResult',
      'PreviousCall',
      'OnwardCall',
      'Attribute',
      'Place',
    ];
    return arrayElements.includes(name);
  },
});

/**
 * Send an OJP XML request and return the parsed response.
 * @param {string} xmlBody - The full OJP XML request body
 * @returns {Promise<Object>} Parsed XML response as a JS object
 */
async function sendOjpRequest(xmlBody) {
  const apiKey = process.env.OPEN_TRANSPORT_API_KEY;
  if (!apiKey) {
    throw new Error('OPEN_TRANSPORT_API_KEY environment variable is not set');
  }

  const response = await fetch(OJP_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/xml',
      Authorization: `Bearer ${apiKey}`,
    },
    body: xmlBody,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OJP API error ${response.status}: ${text}`);
  }

  const xmlText = await response.text();
  return parser.parse(xmlText);
}

module.exports = { sendOjpRequest };
