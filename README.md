# Nginx Proxy Manager OpenAPI

## Requirements

- Node.js
- NPM
- Local copy of [Nginx Proxy Manager](https://github.com/NginxProxyManager/nginx-proxy-manager)

## Installation

1. Install NPM dependencies
   ```bash
   npm install
   ```

## Usage

1. Open the `backend/schema` folder in the `nginx-proxy-manager` repository.
2. Copy the contents of the folder to the root of this project
3. Run the `index.js` file with Node
   ```bash
   node ./index.js
   ```
4. Copy the file `api.swagger.json` to `backend/doc` folder of the `nginx-proxy-manager` repository
