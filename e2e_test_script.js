import http from 'k6/http';
import { sleep, group } from 'k6';
import { check } from 'k6';

// --- Configuration ---
const BASE_URL = 'https://reqres.in/api';
const PEAK_VUS = 50;
const RAMP_UP_DURATION = '2s';
const STEADY_STATE_DURATION = '6s';
const RAMP_DOWN_DURATION = '2s';
const THINK_TIME_SECONDS = 2; // Base think time in seconds

// --- k6 Options ---
export const options = {
  // Stages for defining the load profile
  stages: [
    { duration: RAMP_UP_DURATION, target: PEAK_VUS },    // Ramp up to peak VUs
    { duration: STEADY_STATE_DURATION, target: PEAK_VUS }, // Stay at peak VUs
    { duration: RAMP_DOWN_DURATION, target: 0 },       // Ramp down to 0 VUs
  ],

  // SLA Thresholds for performance validation
  thresholds: {
    // Thresholds specific to the 'Get Users' group
    'http_req_duration{group:::User Session: Continuous User Data Fetch::Get Users}': ['p(99) < 500'], // 99th percentile response time for 'Get Users' must be < 500ms
    'http_req_failed{group:::User Session: Continuous User Data Fetch::Get Users}': ['rate < 0.01'],    // Error rate for 'Get Users' must be < 1.0%

    // Overall thresholds (good practice for general test health)
    'http_req_duration': ['p(99) < 750'], // Overall 99th percentile response time
    'http_req_failed': ['rate < 0.02'],   // Overall error rate
  },

  // Global tags for the test run (optional, but useful for filtering results)
  tags: {
    test_type: 'load_test',
    scenario: 'continuous_user_data_access',
  },
};

// --- Test Data (Parameterized) ---
// For the /api/users endpoint on reqres.in, we can parameterize the 'page' query parameter.
// This simulates fetching different sets of user data.
function getRandomPage() {
  // reqres.in typically has 2 pages of users. We'll randomly select between page 1 and 2.
  // Math.random() returns a float in [0, 1).
  // Math.floor(Math.random() * 2) gives 0 or 1. Adding 1 makes it 1 or 2.
  return Math.floor(Math.random() * 2) + 1;
}

// --- Main Test Logic ---
export default function () {
  // Simulate a continuous user session where the user repeatedly fetches user data.
  group('User Session: Continuous User Data Fetch', function () {

    // Step 1: Retrieve User Data
    group('Get Users', function () {
      const page = getRandomPage(); // Get a random page number for parameterization
      const url = `${BASE_URL}/users?page=${page}`;

      // Send the GET request to retrieve user data
      const res = http.get(url, {
        // Custom tags for this specific request, useful for filtering metrics
        tags: {
          name: 'GET /api/users', // A human-readable name for the request
          endpoint: '/api/users',
          method: 'GET',
          page: page, // Tag with the specific page number used
        },
      });

      // Assertions and Checks for response validation
      check(res, {
        'is status 200': (r) => r.status === 200, // Check if the HTTP status code is 200 OK
        'response body contains data': (r) => r.json() && r.json().data && r.json().data.length > 0, // Check if the response body has user data
        'response time < 500ms': (r) => r.timings.duration < 500, // Check if response time is within an acceptable limit
      });

      // Optional: Log response body for debugging (can be verbose in production runs)
      // console.log(`VU ${__VU} - Iter ${__ITER}: Fetched users from page ${page}. Status: ${res.status}`);
      // console.log(`Response body: ${JSON.stringify(res.json())}`);
    });

    // Realistic think time between requests
    // Randomized ±50% of the base think time (2 seconds)
    // This means think time will be between 1 second (2 * 0.5) and 3 seconds (2 * 1.5)
    const minThinkTime = THINK_TIME_SECONDS * (1 - 0.5);
    const maxThinkTime = THINK_TIME_SECONDS * (1 + 0.5);
    const randomizedThinkTime = Math.random() * (maxThinkTime - minThinkTime) + minThinkTime;

    sleep(randomizedThinkTime); // Pause for the calculated think time
  });
}