<p align="center">
  <img src="https://andera.top/img/github.png" alt="Andera" style="max-width: 100%; height: auto;"/>
</p>

# Andera HTML Fetch Worker

This repository is an [Andera](https://andera.top) Worker built to fetch HTML content from web pages using [Playwright](https://playwright.dev). The Worker creates slots with Chrome contexts, assigns requests to each context, and resets them once the HTML has been fetched. It also supports an automatic fallback to [scrape.do](https://scrape.do) for accessing content protected by antibot systems (Cloudflare, Akamai, DataDome, etc.).

**Andera** is a high-performance, open-source Task Orchestration Platform (TOP) designed for simplicity, flexibility, and scalability. It enables you to build, run, and manage distributed workers for any kind of task, from AI agents to automation scripts.

---

## What is Andera?

Andera is composed of three main components:
- **Load Balancer:** Routes and prioritizes tasks, manages worker clusters, and provides a dashboard for monitoring.
- **Base Worker:** A template project for building your own custom workers by adding business logic (functions, services, helpers, tags).
- **Worker Core:** The core engine, included as a dependency, that handles all non-business logic for workers.

Learn more: [Andera Documentation](https://andera.top/docs/)

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- [Docker](https://www.docker.com/) (optional, for containerized deployment)

### Installation

```sh
git clone git@github.com:JulienRamel/andera-html-fetch-worker.git
cd html-fetch-worker
cp .env.example .env
npm install
```

Edit `.env` to set your keys and configuration.

---

## Configuration

- All environment variables are documented in `.env.example`.
- For advanced configuration, see the [Base Worker Configuration Guide](https://andera.top/docs/base-worker/configuration/).

---

## Usage

### Manual setup

#### Run the application

```sh
npm run dev
```

#### Build & Run in Production

```sh
npm run build
npm start
```

### Docker setup

#### Create a Docker network for Andera

```sh
docker network create andera-net
```

#### Build the Docker image

```sh
docker-compose build
```

#### Run the stack

```sh
docker-compose up
```

This will start the HTML Fetch Worker with all environment variables from your `.env` file.

> **Do not use `docker run` directly.** The recommended way is to use `docker-compose up` to ensure all dependencies and configuration are handled correctly.

The image is named `julienramel/andera-html-fetch-worker` by default.

---

## Endpoints

- `POST /task` — Receives tasks for execution
- `GET /health` — Public status info; more details with authentication
- `GET /logs` — Last 1000 log lines (authentication required)
- `POST /on` and `/off` — Enable/disable task acceptance

All endpoints return gzipped data. Logs are managed natively.  
See [API Reference](https://andera.top/docs/base-worker/usage/) for details.

---

## Fetch HTML from a URL

To fetch HTML content, send a POST request to the `/task` endpoint with a JSON body specifying the URL. Here is an example using `curl`:

```bash
curl -X POST http://localhost:3000/task \
  -H "Content-Type: application/json" \
  -d '{
    "function": "fetchHtml",
    "input": {
      "url": "https://example.com"
    },
    "contract": 1,
    "mode": "sync"
  }'
```

---

### fetchHtml Input Options

| Option           | Type     | Default    | Description                                                                 |
|------------------|----------|------------|-----------------------------------------------------------------------------|
| url              | string   | (required) | The URL of the page to fetch (http or https).                               |
| waitForSelector  | string   | (none)     | If set, waits for this CSS selector to appear before fetching HTML.         |
| delay            | number   | 0          | Delay in milliseconds to wait before fetching HTML.                         |
| userAgent        | string   | (none)     | Custom User-Agent string. Uses Playwright default if not specified.         |
| antibotFallback  | boolean  | false      | If true, uses [scrape.do](https://scrape.do) as fallback when the request fails (except 404). See [Antibot Fallback](#antibot-fallback) below. |

**Example:**
```json
{
  "function": "fetchHtml",
  "input": {
    "url": "https://example.com",
    "waitForSelector": "#content",
    "delay": 1000,
    "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0"
  },
  "contract": 1,
  "mode": "sync"
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "html": "<!DOCTYPE html>...",
    "url": "https://example.com"
  }
}
```

---

### Antibot Fallback

Some websites implement antibot protections (Cloudflare, Akamai, DataDome, etc.) that block standard browser requests. When enabled, the `antibotFallback` option provides automatic fallback to [scrape.do](https://scrape.do) when a request fails.

**How it works:**
- When `antibotFallback: true` is set and the initial Playwright request fails (non-2xx status code, timeout, blocked, etc.), the worker automatically retries using the scrape.do API.
- **404 errors are excluded** from fallback — if a page genuinely doesn't exist, the fallback is not triggered.
- The response will include `antibotFallbackUsed: true` when scrape.do was used.

**Configuration:**

Add your scrape.do API key to your `.env` file:

```env
SCRAPE_DO_API_KEY=your_api_key_here
```

**Example with antibot fallback:**
```json
{
  "function": "fetchHtml",
  "input": {
    "url": "https://protected-website.com",
    "antibotFallback": true
  },
  "contract": 1,
  "mode": "sync"
}
```

**Response when fallback is used:**
```json
{
  "success": true,
  "result": {
    "html": "<!DOCTYPE html>...",
    "url": "https://protected-website.com",
    "antibotFallbackUsed": true
  }
}
```

> **Note:** Using the antibot fallback requires a valid (even free) [scrape.do](https://scrape.do) subscription. The fallback allows scraping any page, even those protected by antibot systems like Cloudflare, Akamai, or DataDome.

---

## Deployment

- [Deployment Guide](https://andera.top/docs/base-worker/deployment/)
- Supports local, Docker, and cloud deployment.

---

## Useful Links

- [Andera Documentation](https://andera.top/docs/)
- [Base Worker Reference](https://andera.top/docs/base-worker/)

---

## Contributing

Andera is open source and community-driven!
See [CONTRIBUTING.md](CONTRIBUTING.md) for repository guidelines, and [How to Contribute](https://andera.top/docs/contribute) for the project's philosophy and license.

---

## License

For license details, see the [LICENSE](LICENSE) file.
