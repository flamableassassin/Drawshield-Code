/*
  The work is designed to do a number of things to increase the speed of the drawshield code including:
    - Caching in Cloudflare's network and on the client 
    - Prevent POST requests to all paths as it can't be cached easily //? Could be added in a later date
    - Remove query params going to the origin server. Such as removing outputformat so that the SVG can be rendered in the worker.
    - Prevent access to most endpoints as for my usage they won't be used
*/

// Modified from:  https://hrishikeshpathak.com/tips/convert-svg-to-png-cloudflare-worker/
import { Resvg, initWasm } from '@resvg/resvg-wasm';
import resvgwasm from './resvg.wasm';

try {
  await initWasm(resvgwasm);
} catch (error) {
  console.error('Resvg wasm not initialized');
}

//* If you are going to use this worker make sure to alter the paths. For example drawshield.net would have the path of `include/drawshield.php` and it wouldn't have a query whitelist
const configPaths = [{
  path: "drawshield/drawshield.php",
  allowedQueries: ["blazon", "shape", "palette", "effect", "size", "ar", "printable", "stage", "webcols", "whcols", "tartancols"]
}, {
  path: "drawshield/randomblazon.php",
  allowedQueries: ["count"]
}]

export default {
  /**
   * @param {import("@cloudflare/workers-types").Request} request
   * @param {import("@cloudflare/workers-types").ExecutionContext} context
   */
  fetch: async (request, env, context) => {
    if (request.method !== 'GET') return new Response(null, { status: 405 }); // Preventing post requests as they can't be cached easily
    const url = new URL(request.url)

    const pathConfig = configPaths.find(i => i.path === url.pathname)
    if (!pathConfig) return new Response(null, { status: 404 });

    let outputFormat = "svg";

    // Removing params that aren't on the allowed list 
    const searchParams = url.searchParams
    if (!!pathConfig.allowedQueries) {
      searchParams.forEach(i => {
        // If the outputformat param is present overwrite the variable
        if (i === "outputformat") outputFormat = searchParams.get("outputformat")
        if (!pathConfig.allowedQueries.includes(i)) searchParams.delete(i)
      })
    }
    outputFormat = outputFormat.toLocaleLowerCase()

    if (outputFormat !== "svg" || outputFormat !== "png") return new Response(JSON.stringify({ error: `Unable to render svg to ${outputFormat}. Supported formats: SVG,PNG` }), { status: 415 })

    const upstreamServerURL = new URL(url.pathname + "?" + searchParams.toString(), url)
    // Creating a hash of the url so that cloudflare can use it as the cache key reducing hits to the origin server
    const URLHash = await hashURL(upstreamServerURL.toString())
    const originResponse = await fetch(upstreamServerURL, {
      cf: {
        cacheEverything: true, // hmmm much cache
        cacheKey: URLHash
      }
    })
    if (outputFormat === "svg") {
      originResponse.headers.set('Cache-Control', 'public, immutable, no-transform, max-age=31536000') // adding cache control for client side caching not sure if this actually works
      return originResponse;
    };
    // TODO: Render the SVG to PNG

  }
};


/**
 * @param {string} content The content to hash
 * @returns {Promise<string>} The Hex output of the Hash 
 */
async function hashURL(content) {
  // https://stackoverflow.com/a/64795218
  const msgUint8 = new TextEncoder().encode(content) // encode as (utf-8) Uint8Array
  const hashBuffer = await crypto.subtle.digest('MD5', msgUint8) // hash the message
  const hashArray = Array.from(new Uint8Array(hashBuffer)) // convert buffer to byte array
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('') // convert bytes to hex string

}