"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(() => {
var exports = {};
exports.id = "app/api/leave/route";
exports.ids = ["app/api/leave/route"];
exports.modules = {

/***/ "@prisma/client":
/*!*********************************!*\
  !*** external "@prisma/client" ***!
  \*********************************/
/***/ ((module) => {

module.exports = require("@prisma/client");

/***/ }),

/***/ "../../client/components/action-async-storage.external":
/*!*******************************************************************************!*\
  !*** external "next/dist/client/components/action-async-storage.external.js" ***!
  \*******************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/client/components/action-async-storage.external.js");

/***/ }),

/***/ "../../client/components/request-async-storage.external":
/*!********************************************************************************!*\
  !*** external "next/dist/client/components/request-async-storage.external.js" ***!
  \********************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/client/components/request-async-storage.external.js");

/***/ }),

/***/ "../../client/components/static-generation-async-storage.external":
/*!******************************************************************************************!*\
  !*** external "next/dist/client/components/static-generation-async-storage.external.js" ***!
  \******************************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/client/components/static-generation-async-storage.external.js");

/***/ }),

/***/ "next/dist/compiled/next-server/app-page.runtime.dev.js":
/*!*************************************************************************!*\
  !*** external "next/dist/compiled/next-server/app-page.runtime.dev.js" ***!
  \*************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/compiled/next-server/app-page.runtime.dev.js");

/***/ }),

/***/ "next/dist/compiled/next-server/app-route.runtime.dev.js":
/*!**************************************************************************!*\
  !*** external "next/dist/compiled/next-server/app-route.runtime.dev.js" ***!
  \**************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/compiled/next-server/app-route.runtime.dev.js");

/***/ }),

/***/ "assert":
/*!*************************!*\
  !*** external "assert" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("assert");

/***/ }),

/***/ "buffer":
/*!*************************!*\
  !*** external "buffer" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("buffer");

/***/ }),

/***/ "crypto":
/*!*************************!*\
  !*** external "crypto" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("crypto");

/***/ }),

/***/ "events":
/*!*************************!*\
  !*** external "events" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("events");

/***/ }),

/***/ "http":
/*!***********************!*\
  !*** external "http" ***!
  \***********************/
/***/ ((module) => {

module.exports = require("http");

/***/ }),

/***/ "https":
/*!************************!*\
  !*** external "https" ***!
  \************************/
/***/ ((module) => {

module.exports = require("https");

/***/ }),

/***/ "querystring":
/*!******************************!*\
  !*** external "querystring" ***!
  \******************************/
/***/ ((module) => {

module.exports = require("querystring");

/***/ }),

/***/ "url":
/*!**********************!*\
  !*** external "url" ***!
  \**********************/
/***/ ((module) => {

module.exports = require("url");

/***/ }),

/***/ "util":
/*!***********************!*\
  !*** external "util" ***!
  \***********************/
/***/ ((module) => {

module.exports = require("util");

/***/ }),

/***/ "zlib":
/*!***********************!*\
  !*** external "zlib" ***!
  \***********************/
/***/ ((module) => {

module.exports = require("zlib");

/***/ }),

/***/ "(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fleave%2Froute&page=%2Fapi%2Fleave%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fleave%2Froute.ts&appDir=C%3A%5CUsers%5CKullan%C4%B1c%C4%B1%5Cvezin-app%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=C%3A%5CUsers%5CKullan%C4%B1c%C4%B1%5Cvezin-app&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!":
/*!***************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************!*\
  !*** ./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fleave%2Froute&page=%2Fapi%2Fleave%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fleave%2Froute.ts&appDir=C%3A%5CUsers%5CKullan%C4%B1c%C4%B1%5Cvezin-app%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=C%3A%5CUsers%5CKullan%C4%B1c%C4%B1%5Cvezin-app&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D! ***!
  \***************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   originalPathname: () => (/* binding */ originalPathname),\n/* harmony export */   patchFetch: () => (/* binding */ patchFetch),\n/* harmony export */   requestAsyncStorage: () => (/* binding */ requestAsyncStorage),\n/* harmony export */   routeModule: () => (/* binding */ routeModule),\n/* harmony export */   serverHooks: () => (/* binding */ serverHooks),\n/* harmony export */   staticGenerationAsyncStorage: () => (/* binding */ staticGenerationAsyncStorage)\n/* harmony export */ });\n/* harmony import */ var next_dist_server_future_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next/dist/server/future/route-modules/app-route/module.compiled */ \"(rsc)/./node_modules/next/dist/server/future/route-modules/app-route/module.compiled.js\");\n/* harmony import */ var next_dist_server_future_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_future_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var next_dist_server_future_route_kind__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! next/dist/server/future/route-kind */ \"(rsc)/./node_modules/next/dist/server/future/route-kind.js\");\n/* harmony import */ var next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! next/dist/server/lib/patch-fetch */ \"(rsc)/./node_modules/next/dist/server/lib/patch-fetch.js\");\n/* harmony import */ var next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__);\n/* harmony import */ var C_Users_Kullan_c_vezin_app_app_api_leave_route_ts__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./app/api/leave/route.ts */ \"(rsc)/./app/api/leave/route.ts\");\n\n\n\n\n// We inject the nextConfigOutput here so that we can use them in the route\n// module.\nconst nextConfigOutput = \"\"\nconst routeModule = new next_dist_server_future_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__.AppRouteRouteModule({\n    definition: {\n        kind: next_dist_server_future_route_kind__WEBPACK_IMPORTED_MODULE_1__.RouteKind.APP_ROUTE,\n        page: \"/api/leave/route\",\n        pathname: \"/api/leave\",\n        filename: \"route\",\n        bundlePath: \"app/api/leave/route\"\n    },\n    resolvedPagePath: \"C:\\\\Users\\\\Kullanıcı\\\\vezin-app\\\\app\\\\api\\\\leave\\\\route.ts\",\n    nextConfigOutput,\n    userland: C_Users_Kullan_c_vezin_app_app_api_leave_route_ts__WEBPACK_IMPORTED_MODULE_3__\n});\n// Pull out the exports that we need to expose from the module. This should\n// be eliminated when we've moved the other routes to the new format. These\n// are used to hook into the route.\nconst { requestAsyncStorage, staticGenerationAsyncStorage, serverHooks } = routeModule;\nconst originalPathname = \"/api/leave/route\";\nfunction patchFetch() {\n    return (0,next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__.patchFetch)({\n        serverHooks,\n        staticGenerationAsyncStorage\n    });\n}\n\n\n//# sourceMappingURL=app-route.js.map//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9ub2RlX21vZHVsZXMvbmV4dC9kaXN0L2J1aWxkL3dlYnBhY2svbG9hZGVycy9uZXh0LWFwcC1sb2FkZXIuanM/bmFtZT1hcHAlMkZhcGklMkZsZWF2ZSUyRnJvdXRlJnBhZ2U9JTJGYXBpJTJGbGVhdmUlMkZyb3V0ZSZhcHBQYXRocz0mcGFnZVBhdGg9cHJpdmF0ZS1uZXh0LWFwcC1kaXIlMkZhcGklMkZsZWF2ZSUyRnJvdXRlLnRzJmFwcERpcj1DJTNBJTVDVXNlcnMlNUNLdWxsYW4lQzQlQjFjJUM0JUIxJTVDdmV6aW4tYXBwJTVDYXBwJnBhZ2VFeHRlbnNpb25zPXRzeCZwYWdlRXh0ZW5zaW9ucz10cyZwYWdlRXh0ZW5zaW9ucz1qc3gmcGFnZUV4dGVuc2lvbnM9anMmcm9vdERpcj1DJTNBJTVDVXNlcnMlNUNLdWxsYW4lQzQlQjFjJUM0JUIxJTVDdmV6aW4tYXBwJmlzRGV2PXRydWUmdHNjb25maWdQYXRoPXRzY29uZmlnLmpzb24mYmFzZVBhdGg9JmFzc2V0UHJlZml4PSZuZXh0Q29uZmlnT3V0cHV0PSZwcmVmZXJyZWRSZWdpb249Jm1pZGRsZXdhcmVDb25maWc9ZTMwJTNEISIsIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7QUFBc0c7QUFDdkM7QUFDYztBQUNVO0FBQ3ZGO0FBQ0E7QUFDQTtBQUNBLHdCQUF3QixnSEFBbUI7QUFDM0M7QUFDQSxjQUFjLHlFQUFTO0FBQ3ZCO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMO0FBQ0E7QUFDQSxZQUFZO0FBQ1osQ0FBQztBQUNEO0FBQ0E7QUFDQTtBQUNBLFFBQVEsaUVBQWlFO0FBQ3pFO0FBQ0E7QUFDQSxXQUFXLDRFQUFXO0FBQ3RCO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDdUg7O0FBRXZIIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vdmV6aW4tYXBwLz9iYjQ4Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFwcFJvdXRlUm91dGVNb2R1bGUgfSBmcm9tIFwibmV4dC9kaXN0L3NlcnZlci9mdXR1cmUvcm91dGUtbW9kdWxlcy9hcHAtcm91dGUvbW9kdWxlLmNvbXBpbGVkXCI7XG5pbXBvcnQgeyBSb3V0ZUtpbmQgfSBmcm9tIFwibmV4dC9kaXN0L3NlcnZlci9mdXR1cmUvcm91dGUta2luZFwiO1xuaW1wb3J0IHsgcGF0Y2hGZXRjaCBhcyBfcGF0Y2hGZXRjaCB9IGZyb20gXCJuZXh0L2Rpc3Qvc2VydmVyL2xpYi9wYXRjaC1mZXRjaFwiO1xuaW1wb3J0ICogYXMgdXNlcmxhbmQgZnJvbSBcIkM6XFxcXFVzZXJzXFxcXEt1bGxhbsSxY8SxXFxcXHZlemluLWFwcFxcXFxhcHBcXFxcYXBpXFxcXGxlYXZlXFxcXHJvdXRlLnRzXCI7XG4vLyBXZSBpbmplY3QgdGhlIG5leHRDb25maWdPdXRwdXQgaGVyZSBzbyB0aGF0IHdlIGNhbiB1c2UgdGhlbSBpbiB0aGUgcm91dGVcbi8vIG1vZHVsZS5cbmNvbnN0IG5leHRDb25maWdPdXRwdXQgPSBcIlwiXG5jb25zdCByb3V0ZU1vZHVsZSA9IG5ldyBBcHBSb3V0ZVJvdXRlTW9kdWxlKHtcbiAgICBkZWZpbml0aW9uOiB7XG4gICAgICAgIGtpbmQ6IFJvdXRlS2luZC5BUFBfUk9VVEUsXG4gICAgICAgIHBhZ2U6IFwiL2FwaS9sZWF2ZS9yb3V0ZVwiLFxuICAgICAgICBwYXRobmFtZTogXCIvYXBpL2xlYXZlXCIsXG4gICAgICAgIGZpbGVuYW1lOiBcInJvdXRlXCIsXG4gICAgICAgIGJ1bmRsZVBhdGg6IFwiYXBwL2FwaS9sZWF2ZS9yb3V0ZVwiXG4gICAgfSxcbiAgICByZXNvbHZlZFBhZ2VQYXRoOiBcIkM6XFxcXFVzZXJzXFxcXEt1bGxhbsSxY8SxXFxcXHZlemluLWFwcFxcXFxhcHBcXFxcYXBpXFxcXGxlYXZlXFxcXHJvdXRlLnRzXCIsXG4gICAgbmV4dENvbmZpZ091dHB1dCxcbiAgICB1c2VybGFuZFxufSk7XG4vLyBQdWxsIG91dCB0aGUgZXhwb3J0cyB0aGF0IHdlIG5lZWQgdG8gZXhwb3NlIGZyb20gdGhlIG1vZHVsZS4gVGhpcyBzaG91bGRcbi8vIGJlIGVsaW1pbmF0ZWQgd2hlbiB3ZSd2ZSBtb3ZlZCB0aGUgb3RoZXIgcm91dGVzIHRvIHRoZSBuZXcgZm9ybWF0LiBUaGVzZVxuLy8gYXJlIHVzZWQgdG8gaG9vayBpbnRvIHRoZSByb3V0ZS5cbmNvbnN0IHsgcmVxdWVzdEFzeW5jU3RvcmFnZSwgc3RhdGljR2VuZXJhdGlvbkFzeW5jU3RvcmFnZSwgc2VydmVySG9va3MgfSA9IHJvdXRlTW9kdWxlO1xuY29uc3Qgb3JpZ2luYWxQYXRobmFtZSA9IFwiL2FwaS9sZWF2ZS9yb3V0ZVwiO1xuZnVuY3Rpb24gcGF0Y2hGZXRjaCgpIHtcbiAgICByZXR1cm4gX3BhdGNoRmV0Y2goe1xuICAgICAgICBzZXJ2ZXJIb29rcyxcbiAgICAgICAgc3RhdGljR2VuZXJhdGlvbkFzeW5jU3RvcmFnZVxuICAgIH0pO1xufVxuZXhwb3J0IHsgcm91dGVNb2R1bGUsIHJlcXVlc3RBc3luY1N0b3JhZ2UsIHN0YXRpY0dlbmVyYXRpb25Bc3luY1N0b3JhZ2UsIHNlcnZlckhvb2tzLCBvcmlnaW5hbFBhdGhuYW1lLCBwYXRjaEZldGNoLCAgfTtcblxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9YXBwLXJvdXRlLmpzLm1hcCJdLCJuYW1lcyI6W10sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fleave%2Froute&page=%2Fapi%2Fleave%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fleave%2Froute.ts&appDir=C%3A%5CUsers%5CKullan%C4%B1c%C4%B1%5Cvezin-app%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=C%3A%5CUsers%5CKullan%C4%B1c%C4%B1%5Cvezin-app&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!\n");

/***/ }),

/***/ "(rsc)/./app/api/leave/route.ts":
/*!********************************!*\
  !*** ./app/api/leave/route.ts ***!
  \********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   GET: () => (/* binding */ GET),\n/* harmony export */   POST: () => (/* binding */ POST)\n/* harmony export */ });\n/* harmony import */ var next_server__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next/server */ \"(rsc)/./node_modules/next/dist/api/server.js\");\n/* harmony import */ var next_auth__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! next-auth */ \"(rsc)/./node_modules/next-auth/index.js\");\n/* harmony import */ var next_auth__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(next_auth__WEBPACK_IMPORTED_MODULE_1__);\n/* harmony import */ var _lib_auth__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @/lib/auth */ \"(rsc)/./lib/auth.ts\");\n/* harmony import */ var _lib_prisma__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @/lib/prisma */ \"(rsc)/./lib/prisma.ts\");\n\n\n\n\nasync function GET() {\n    const session = await (0,next_auth__WEBPACK_IMPORTED_MODULE_1__.getServerSession)(_lib_auth__WEBPACK_IMPORTED_MODULE_2__.authOptions);\n    if (!session) return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n        error: \"Yetkisiz\"\n    }, {\n        status: 401\n    });\n    const userId = session.user.id;\n    const role = session.user.role;\n    const department = session.user.department;\n    const isAdmin = role === \"ADMIN\";\n    const isMuhasebe = department === \"MUHASEBE\";\n    const requests = await _lib_prisma__WEBPACK_IMPORTED_MODULE_3__.prisma.leaveRequest.findMany({\n        where: isAdmin || isMuhasebe ? {} : {\n            userId\n        },\n        include: {\n            user: {\n                select: {\n                    id: true,\n                    name: true,\n                    email: true,\n                    department: true\n                }\n            }\n        },\n        orderBy: {\n            createdAt: \"desc\"\n        }\n    });\n    // Admin ve muhasebe düz array alır; çalışanlar balance ile birlikte alır\n    if (isAdmin || isMuhasebe) {\n        return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json(requests);\n    }\n    const balance = await _lib_prisma__WEBPACK_IMPORTED_MODULE_3__.prisma.leaveBalance.findUnique({\n        where: {\n            userId_year: {\n                userId,\n                year: new Date().getFullYear()\n            }\n        }\n    });\n    return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n        requests,\n        balance\n    });\n}\nasync function POST(req) {\n    const session = await (0,next_auth__WEBPACK_IMPORTED_MODULE_1__.getServerSession)(_lib_auth__WEBPACK_IMPORTED_MODULE_2__.authOptions);\n    if (!session) return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n        error: \"Yetkisiz\"\n    }, {\n        status: 401\n    });\n    const userId = session.user.id;\n    const { startDate, endDate, type, note } = await req.json();\n    if (!startDate || !endDate || !type) {\n        return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n            error: \"Başlangı\\xe7, bitiş tarihi ve izin t\\xfcr\\xfc gerekli\"\n        }, {\n            status: 400\n        });\n    }\n    const validTypes = [\n        \"ANNUAL\",\n        \"EXCUSE\",\n        \"UNPAID\"\n    ];\n    if (!validTypes.includes(type)) {\n        return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n            error: \"Ge\\xe7ersiz izin t\\xfcr\\xfc\"\n        }, {\n            status: 400\n        });\n    }\n    const start = new Date(startDate);\n    const end = new Date(endDate);\n    if (end < start) {\n        return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n            error: \"Bitiş tarihi başlangı\\xe7tan \\xf6nce olamaz\"\n        }, {\n            status: 400\n        });\n    }\n    // İş günü hesapla (Pzt-Cum)\n    let days = 0;\n    const cur = new Date(start);\n    while(cur <= end){\n        const dow = cur.getDay();\n        if (dow !== 0 && dow !== 6) days++;\n        cur.setDate(cur.getDate() + 1);\n    }\n    if (days === 0) {\n        return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n            error: \"Se\\xe7ilen aralıkta iş g\\xfcn\\xfc bulunmuyor\"\n        }, {\n            status: 400\n        });\n    }\n    // Yıllık izin için bakiye kontrol/oluştur\n    if (type === \"ANNUAL\") {\n        const year = start.getFullYear();\n        const balance = await _lib_prisma__WEBPACK_IMPORTED_MODULE_3__.prisma.leaveBalance.upsert({\n            where: {\n                userId_year: {\n                    userId,\n                    year\n                }\n            },\n            create: {\n                userId,\n                year,\n                totalDays: 14,\n                usedDays: 0,\n                remainingDays: 14\n            },\n            update: {}\n        });\n        if (balance.remainingDays < days) {\n            return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n                error: `Yeterli yıllık izin bakiyesi yok. Kalan: ${balance.remainingDays} gün`\n            }, {\n                status: 400\n            });\n        }\n    }\n    const request = await _lib_prisma__WEBPACK_IMPORTED_MODULE_3__.prisma.leaveRequest.create({\n        data: {\n            userId,\n            startDate: start,\n            endDate: end,\n            days,\n            type,\n            note: note?.trim() || null,\n            status: \"PENDING\"\n        },\n        include: {\n            user: {\n                select: {\n                    id: true,\n                    name: true,\n                    email: true,\n                    department: true\n                }\n            }\n        }\n    });\n    return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json(request, {\n        status: 201\n    });\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,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Y2s6Ly92ZXppbi1hcHAvLi9hcHAvYXBpL2xlYXZlL3JvdXRlLnRzPzA0YmIiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgTmV4dFJlcXVlc3QsIE5leHRSZXNwb25zZSB9IGZyb20gXCJuZXh0L3NlcnZlclwiO1xuaW1wb3J0IHsgZ2V0U2VydmVyU2Vzc2lvbiB9IGZyb20gXCJuZXh0LWF1dGhcIjtcbmltcG9ydCB7IGF1dGhPcHRpb25zIH0gZnJvbSBcIkAvbGliL2F1dGhcIjtcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gXCJAL2xpYi9wcmlzbWFcIjtcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIEdFVCgpIHtcbiAgY29uc3Qgc2Vzc2lvbiA9IGF3YWl0IGdldFNlcnZlclNlc3Npb24oYXV0aE9wdGlvbnMpO1xuICBpZiAoIXNlc3Npb24pIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbih7IGVycm9yOiBcIllldGtpc2l6XCIgfSwgeyBzdGF0dXM6IDQwMSB9KTtcblxuICBjb25zdCB1c2VySWQgPSAoc2Vzc2lvbi51c2VyIGFzIGFueSkuaWQgYXMgc3RyaW5nO1xuICBjb25zdCByb2xlID0gKHNlc3Npb24udXNlciBhcyBhbnkpLnJvbGUgYXMgc3RyaW5nO1xuICBjb25zdCBkZXBhcnRtZW50ID0gKHNlc3Npb24udXNlciBhcyBhbnkpLmRlcGFydG1lbnQgYXMgc3RyaW5nO1xuXG4gIGNvbnN0IGlzQWRtaW4gPSByb2xlID09PSBcIkFETUlOXCI7XG4gIGNvbnN0IGlzTXVoYXNlYmUgPSBkZXBhcnRtZW50ID09PSBcIk1VSEFTRUJFXCI7XG5cbiAgY29uc3QgcmVxdWVzdHMgPSBhd2FpdCBwcmlzbWEubGVhdmVSZXF1ZXN0LmZpbmRNYW55KHtcbiAgICB3aGVyZTogaXNBZG1pbiB8fCBpc011aGFzZWJlID8ge30gOiB7IHVzZXJJZCB9LFxuICAgIGluY2x1ZGU6IHtcbiAgICAgIHVzZXI6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlLCBlbWFpbDogdHJ1ZSwgZGVwYXJ0bWVudDogdHJ1ZSB9IH0sXG4gICAgfSxcbiAgICBvcmRlckJ5OiB7IGNyZWF0ZWRBdDogXCJkZXNjXCIgfSxcbiAgfSk7XG5cbiAgLy8gQWRtaW4gdmUgbXVoYXNlYmUgZMO8eiBhcnJheSBhbMSxcjsgw6dhbMSxxZ9hbmxhciBiYWxhbmNlIGlsZSBiaXJsaWt0ZSBhbMSxclxuICBpZiAoaXNBZG1pbiB8fCBpc011aGFzZWJlKSB7XG4gICAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKHJlcXVlc3RzKTtcbiAgfVxuXG4gIGNvbnN0IGJhbGFuY2UgPSBhd2FpdCBwcmlzbWEubGVhdmVCYWxhbmNlLmZpbmRVbmlxdWUoe1xuICAgIHdoZXJlOiB7IHVzZXJJZF95ZWFyOiB7IHVzZXJJZCwgeWVhcjogbmV3IERhdGUoKS5nZXRGdWxsWWVhcigpIH0gfSxcbiAgfSk7XG5cbiAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKHsgcmVxdWVzdHMsIGJhbGFuY2UgfSk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBQT1NUKHJlcTogTmV4dFJlcXVlc3QpIHtcbiAgY29uc3Qgc2Vzc2lvbiA9IGF3YWl0IGdldFNlcnZlclNlc3Npb24oYXV0aE9wdGlvbnMpO1xuICBpZiAoIXNlc3Npb24pIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbih7IGVycm9yOiBcIllldGtpc2l6XCIgfSwgeyBzdGF0dXM6IDQwMSB9KTtcblxuICBjb25zdCB1c2VySWQgPSAoc2Vzc2lvbi51c2VyIGFzIGFueSkuaWQgYXMgc3RyaW5nO1xuXG4gIGNvbnN0IHsgc3RhcnREYXRlLCBlbmREYXRlLCB0eXBlLCBub3RlIH0gPSBhd2FpdCByZXEuanNvbigpO1xuXG4gIGlmICghc3RhcnREYXRlIHx8ICFlbmREYXRlIHx8ICF0eXBlKSB7XG4gICAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKHsgZXJyb3I6IFwiQmHFn2xhbmfEscOnLCBiaXRpxZ8gdGFyaWhpIHZlIGl6aW4gdMO8csO8IGdlcmVrbGlcIiB9LCB7IHN0YXR1czogNDAwIH0pO1xuICB9XG5cbiAgY29uc3QgdmFsaWRUeXBlcyA9IFtcIkFOTlVBTFwiLCBcIkVYQ1VTRVwiLCBcIlVOUEFJRFwiXTtcbiAgaWYgKCF2YWxpZFR5cGVzLmluY2x1ZGVzKHR5cGUpKSB7XG4gICAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKHsgZXJyb3I6IFwiR2XDp2Vyc2l6IGl6aW4gdMO8csO8XCIgfSwgeyBzdGF0dXM6IDQwMCB9KTtcbiAgfVxuXG4gIGNvbnN0IHN0YXJ0ID0gbmV3IERhdGUoc3RhcnREYXRlKTtcbiAgY29uc3QgZW5kID0gbmV3IERhdGUoZW5kRGF0ZSk7XG4gIGlmIChlbmQgPCBzdGFydCkge1xuICAgIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbih7IGVycm9yOiBcIkJpdGnFnyB0YXJpaGkgYmHFn2xhbmfEscOndGFuIMO2bmNlIG9sYW1helwiIH0sIHsgc3RhdHVzOiA0MDAgfSk7XG4gIH1cblxuICAvLyDEsMWfIGfDvG7DvCBoZXNhcGxhIChQenQtQ3VtKVxuICBsZXQgZGF5cyA9IDA7XG4gIGNvbnN0IGN1ciA9IG5ldyBEYXRlKHN0YXJ0KTtcbiAgd2hpbGUgKGN1ciA8PSBlbmQpIHtcbiAgICBjb25zdCBkb3cgPSBjdXIuZ2V0RGF5KCk7XG4gICAgaWYgKGRvdyAhPT0gMCAmJiBkb3cgIT09IDYpIGRheXMrKztcbiAgICBjdXIuc2V0RGF0ZShjdXIuZ2V0RGF0ZSgpICsgMSk7XG4gIH1cbiAgaWYgKGRheXMgPT09IDApIHtcbiAgICByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oeyBlcnJvcjogXCJTZcOnaWxlbiBhcmFsxLFrdGEgacWfIGfDvG7DvCBidWx1bm11eW9yXCIgfSwgeyBzdGF0dXM6IDQwMCB9KTtcbiAgfVxuXG4gIC8vIFnEsWxsxLFrIGl6aW4gacOnaW4gYmFraXllIGtvbnRyb2wvb2x1xZ90dXJcbiAgaWYgKHR5cGUgPT09IFwiQU5OVUFMXCIpIHtcbiAgICBjb25zdCB5ZWFyID0gc3RhcnQuZ2V0RnVsbFllYXIoKTtcbiAgICBjb25zdCBiYWxhbmNlID0gYXdhaXQgcHJpc21hLmxlYXZlQmFsYW5jZS51cHNlcnQoe1xuICAgICAgd2hlcmU6IHsgdXNlcklkX3llYXI6IHsgdXNlcklkLCB5ZWFyIH0gfSxcbiAgICAgIGNyZWF0ZTogeyB1c2VySWQsIHllYXIsIHRvdGFsRGF5czogMTQsIHVzZWREYXlzOiAwLCByZW1haW5pbmdEYXlzOiAxNCB9LFxuICAgICAgdXBkYXRlOiB7fSxcbiAgICB9KTtcbiAgICBpZiAoYmFsYW5jZS5yZW1haW5pbmdEYXlzIDwgZGF5cykge1xuICAgICAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKFxuICAgICAgICB7IGVycm9yOiBgWWV0ZXJsaSB5xLFsbMSxayBpemluIGJha2l5ZXNpIHlvay4gS2FsYW46ICR7YmFsYW5jZS5yZW1haW5pbmdEYXlzfSBnw7xuYCB9LFxuICAgICAgICB7IHN0YXR1czogNDAwIH1cbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgY29uc3QgcmVxdWVzdCA9IGF3YWl0IHByaXNtYS5sZWF2ZVJlcXVlc3QuY3JlYXRlKHtcbiAgICBkYXRhOiB7XG4gICAgICB1c2VySWQsXG4gICAgICBzdGFydERhdGU6IHN0YXJ0LFxuICAgICAgZW5kRGF0ZTogZW5kLFxuICAgICAgZGF5cyxcbiAgICAgIHR5cGUsXG4gICAgICBub3RlOiBub3RlPy50cmltKCkgfHwgbnVsbCxcbiAgICAgIHN0YXR1czogXCJQRU5ESU5HXCIsXG4gICAgfSxcbiAgICBpbmNsdWRlOiB7IHVzZXI6IHsgc2VsZWN0OiB7IGlkOiB0cnVlLCBuYW1lOiB0cnVlLCBlbWFpbDogdHJ1ZSwgZGVwYXJ0bWVudDogdHJ1ZSB9IH0gfSxcbiAgfSk7XG5cbiAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKHJlcXVlc3QsIHsgc3RhdHVzOiAyMDEgfSk7XG59XG4iXSwibmFtZXMiOlsiTmV4dFJlc3BvbnNlIiwiZ2V0U2VydmVyU2Vzc2lvbiIsImF1dGhPcHRpb25zIiwicHJpc21hIiwiR0VUIiwic2Vzc2lvbiIsImpzb24iLCJlcnJvciIsInN0YXR1cyIsInVzZXJJZCIsInVzZXIiLCJpZCIsInJvbGUiLCJkZXBhcnRtZW50IiwiaXNBZG1pbiIsImlzTXVoYXNlYmUiLCJyZXF1ZXN0cyIsImxlYXZlUmVxdWVzdCIsImZpbmRNYW55Iiwid2hlcmUiLCJpbmNsdWRlIiwic2VsZWN0IiwibmFtZSIsImVtYWlsIiwib3JkZXJCeSIsImNyZWF0ZWRBdCIsImJhbGFuY2UiLCJsZWF2ZUJhbGFuY2UiLCJmaW5kVW5pcXVlIiwidXNlcklkX3llYXIiLCJ5ZWFyIiwiRGF0ZSIsImdldEZ1bGxZZWFyIiwiUE9TVCIsInJlcSIsInN0YXJ0RGF0ZSIsImVuZERhdGUiLCJ0eXBlIiwibm90ZSIsInZhbGlkVHlwZXMiLCJpbmNsdWRlcyIsInN0YXJ0IiwiZW5kIiwiZGF5cyIsImN1ciIsImRvdyIsImdldERheSIsInNldERhdGUiLCJnZXREYXRlIiwidXBzZXJ0IiwiY3JlYXRlIiwidG90YWxEYXlzIiwidXNlZERheXMiLCJyZW1haW5pbmdEYXlzIiwidXBkYXRlIiwicmVxdWVzdCIsImRhdGEiLCJ0cmltIl0sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(rsc)/./app/api/leave/route.ts\n");

/***/ }),

/***/ "(rsc)/./lib/auth.ts":
/*!*********************!*\
  !*** ./lib/auth.ts ***!
  \*********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   authOptions: () => (/* binding */ authOptions)\n/* harmony export */ });\n/* harmony import */ var next_auth_providers_credentials__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next-auth/providers/credentials */ \"(rsc)/./node_modules/next-auth/providers/credentials.js\");\n/* harmony import */ var _prisma__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./prisma */ \"(rsc)/./lib/prisma.ts\");\n/* harmony import */ var bcryptjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! bcryptjs */ \"(rsc)/./node_modules/bcryptjs/index.js\");\n/* harmony import */ var bcryptjs__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(bcryptjs__WEBPACK_IMPORTED_MODULE_2__);\n\n\n\nconst authOptions = {\n    providers: [\n        (0,next_auth_providers_credentials__WEBPACK_IMPORTED_MODULE_0__[\"default\"])({\n            name: \"Credentials\",\n            credentials: {\n                email: {\n                    label: \"E-posta\",\n                    type: \"email\"\n                },\n                password: {\n                    label: \"Şifre\",\n                    type: \"password\"\n                }\n            },\n            async authorize (credentials) {\n                if (!credentials?.email || !credentials?.password) return null;\n                const user = await _prisma__WEBPACK_IMPORTED_MODULE_1__.prisma.user.findUnique({\n                    where: {\n                        email: credentials.email\n                    }\n                });\n                if (!user) return null;\n                const valid = await bcryptjs__WEBPACK_IMPORTED_MODULE_2___default().compare(credentials.password, user.password);\n                if (!valid) return null;\n                return {\n                    id: user.id,\n                    name: user.name,\n                    email: user.email,\n                    role: user.role,\n                    department: user.department\n                };\n            }\n        })\n    ],\n    session: {\n        strategy: \"jwt\"\n    },\n    callbacks: {\n        jwt ({ token, user }) {\n            if (user) {\n                token.id = user.id;\n                token.role = user.role;\n                token.department = user.department;\n            }\n            return token;\n        },\n        session ({ session, token }) {\n            if (session.user) {\n                session.user.id = token.id;\n                session.user.role = token.role;\n                session.user.department = token.department;\n            }\n            return session;\n        }\n    },\n    pages: {\n        signIn: \"/login\"\n    },\n    secret: process.env.NEXTAUTH_SECRET\n};\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9saWIvYXV0aC50cyIsIm1hcHBpbmdzIjoiOzs7Ozs7OztBQUNrRTtBQUNoQztBQUNKO0FBRXZCLE1BQU1HLGNBQStCO0lBQzFDQyxXQUFXO1FBQ1RKLDJFQUFtQkEsQ0FBQztZQUNsQkssTUFBTTtZQUNOQyxhQUFhO2dCQUNYQyxPQUFPO29CQUFFQyxPQUFPO29CQUFXQyxNQUFNO2dCQUFRO2dCQUN6Q0MsVUFBVTtvQkFBRUYsT0FBTztvQkFBU0MsTUFBTTtnQkFBVztZQUMvQztZQUNBLE1BQU1FLFdBQVVMLFdBQVc7Z0JBQ3pCLElBQUksQ0FBQ0EsYUFBYUMsU0FBUyxDQUFDRCxhQUFhSSxVQUFVLE9BQU87Z0JBRTFELE1BQU1FLE9BQU8sTUFBTVgsMkNBQU1BLENBQUNXLElBQUksQ0FBQ0MsVUFBVSxDQUFDO29CQUN4Q0MsT0FBTzt3QkFBRVAsT0FBT0QsWUFBWUMsS0FBSztvQkFBQztnQkFDcEM7Z0JBQ0EsSUFBSSxDQUFDSyxNQUFNLE9BQU87Z0JBRWxCLE1BQU1HLFFBQVEsTUFBTWIsdURBQWMsQ0FBQ0ksWUFBWUksUUFBUSxFQUFFRSxLQUFLRixRQUFRO2dCQUN0RSxJQUFJLENBQUNLLE9BQU8sT0FBTztnQkFFbkIsT0FBTztvQkFDTEUsSUFBSUwsS0FBS0ssRUFBRTtvQkFDWFosTUFBTU8sS0FBS1AsSUFBSTtvQkFDZkUsT0FBT0ssS0FBS0wsS0FBSztvQkFDakJXLE1BQU1OLEtBQUtNLElBQUk7b0JBQ2ZDLFlBQVlQLEtBQUtPLFVBQVU7Z0JBQzdCO1lBQ0Y7UUFDRjtLQUNEO0lBQ0RDLFNBQVM7UUFBRUMsVUFBVTtJQUFNO0lBQzNCQyxXQUFXO1FBQ1RDLEtBQUksRUFBRUMsS0FBSyxFQUFFWixJQUFJLEVBQUU7WUFDakIsSUFBSUEsTUFBTTtnQkFDUlksTUFBTVAsRUFBRSxHQUFHTCxLQUFLSyxFQUFFO2dCQUNsQk8sTUFBTU4sSUFBSSxHQUFHLEtBQWNBLElBQUk7Z0JBQy9CTSxNQUFNTCxVQUFVLEdBQUcsS0FBY0EsVUFBVTtZQUM3QztZQUNBLE9BQU9LO1FBQ1Q7UUFDQUosU0FBUSxFQUFFQSxPQUFPLEVBQUVJLEtBQUssRUFBRTtZQUN4QixJQUFJSixRQUFRUixJQUFJLEVBQUU7Z0JBQ2ZRLFFBQVFSLElBQUksQ0FBU0ssRUFBRSxHQUFHTyxNQUFNUCxFQUFFO2dCQUNsQ0csUUFBUVIsSUFBSSxDQUFTTSxJQUFJLEdBQUdNLE1BQU1OLElBQUk7Z0JBQ3RDRSxRQUFRUixJQUFJLENBQVNPLFVBQVUsR0FBR0ssTUFBTUwsVUFBVTtZQUNyRDtZQUNBLE9BQU9DO1FBQ1Q7SUFDRjtJQUNBSyxPQUFPO1FBQUVDLFFBQVE7SUFBUztJQUMxQkMsUUFBUUMsUUFBUUMsR0FBRyxDQUFDQyxlQUFlO0FBQ3JDLEVBQUUiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly92ZXppbi1hcHAvLi9saWIvYXV0aC50cz9iZjdlIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IE5leHRBdXRoT3B0aW9ucyB9IGZyb20gXCJuZXh0LWF1dGhcIjtcbmltcG9ydCBDcmVkZW50aWFsc1Byb3ZpZGVyIGZyb20gXCJuZXh0LWF1dGgvcHJvdmlkZXJzL2NyZWRlbnRpYWxzXCI7XG5pbXBvcnQgeyBwcmlzbWEgfSBmcm9tIFwiLi9wcmlzbWFcIjtcbmltcG9ydCBiY3J5cHQgZnJvbSBcImJjcnlwdGpzXCI7XG5cbmV4cG9ydCBjb25zdCBhdXRoT3B0aW9uczogTmV4dEF1dGhPcHRpb25zID0ge1xuICBwcm92aWRlcnM6IFtcbiAgICBDcmVkZW50aWFsc1Byb3ZpZGVyKHtcbiAgICAgIG5hbWU6IFwiQ3JlZGVudGlhbHNcIixcbiAgICAgIGNyZWRlbnRpYWxzOiB7XG4gICAgICAgIGVtYWlsOiB7IGxhYmVsOiBcIkUtcG9zdGFcIiwgdHlwZTogXCJlbWFpbFwiIH0sXG4gICAgICAgIHBhc3N3b3JkOiB7IGxhYmVsOiBcIsWeaWZyZVwiLCB0eXBlOiBcInBhc3N3b3JkXCIgfSxcbiAgICAgIH0sXG4gICAgICBhc3luYyBhdXRob3JpemUoY3JlZGVudGlhbHMpIHtcbiAgICAgICAgaWYgKCFjcmVkZW50aWFscz8uZW1haWwgfHwgIWNyZWRlbnRpYWxzPy5wYXNzd29yZCkgcmV0dXJuIG51bGw7XG5cbiAgICAgICAgY29uc3QgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmZpbmRVbmlxdWUoe1xuICAgICAgICAgIHdoZXJlOiB7IGVtYWlsOiBjcmVkZW50aWFscy5lbWFpbCB9LFxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKCF1c2VyKSByZXR1cm4gbnVsbDtcblxuICAgICAgICBjb25zdCB2YWxpZCA9IGF3YWl0IGJjcnlwdC5jb21wYXJlKGNyZWRlbnRpYWxzLnBhc3N3b3JkLCB1c2VyLnBhc3N3b3JkKTtcbiAgICAgICAgaWYgKCF2YWxpZCkgcmV0dXJuIG51bGw7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBpZDogdXNlci5pZCxcbiAgICAgICAgICBuYW1lOiB1c2VyLm5hbWUsXG4gICAgICAgICAgZW1haWw6IHVzZXIuZW1haWwsXG4gICAgICAgICAgcm9sZTogdXNlci5yb2xlIGFzIFwiQURNSU5cIiB8IFwiTUFOQUdFUlwiIHwgXCJFTVBMT1lFRVwiLFxuICAgICAgICAgIGRlcGFydG1lbnQ6IHVzZXIuZGVwYXJ0bWVudCxcbiAgICAgICAgfTtcbiAgICAgIH0sXG4gICAgfSksXG4gIF0sXG4gIHNlc3Npb246IHsgc3RyYXRlZ3k6IFwiand0XCIgfSxcbiAgY2FsbGJhY2tzOiB7XG4gICAgand0KHsgdG9rZW4sIHVzZXIgfSkge1xuICAgICAgaWYgKHVzZXIpIHtcbiAgICAgICAgdG9rZW4uaWQgPSB1c2VyLmlkO1xuICAgICAgICB0b2tlbi5yb2xlID0gKHVzZXIgYXMgYW55KS5yb2xlO1xuICAgICAgICB0b2tlbi5kZXBhcnRtZW50ID0gKHVzZXIgYXMgYW55KS5kZXBhcnRtZW50O1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRva2VuO1xuICAgIH0sXG4gICAgc2Vzc2lvbih7IHNlc3Npb24sIHRva2VuIH0pIHtcbiAgICAgIGlmIChzZXNzaW9uLnVzZXIpIHtcbiAgICAgICAgKHNlc3Npb24udXNlciBhcyBhbnkpLmlkID0gdG9rZW4uaWQgYXMgc3RyaW5nO1xuICAgICAgICAoc2Vzc2lvbi51c2VyIGFzIGFueSkucm9sZSA9IHRva2VuLnJvbGUgYXMgc3RyaW5nO1xuICAgICAgICAoc2Vzc2lvbi51c2VyIGFzIGFueSkuZGVwYXJ0bWVudCA9IHRva2VuLmRlcGFydG1lbnQgYXMgc3RyaW5nO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHNlc3Npb247XG4gICAgfSxcbiAgfSxcbiAgcGFnZXM6IHsgc2lnbkluOiBcIi9sb2dpblwiIH0sXG4gIHNlY3JldDogcHJvY2Vzcy5lbnYuTkVYVEFVVEhfU0VDUkVULFxufTtcbiJdLCJuYW1lcyI6WyJDcmVkZW50aWFsc1Byb3ZpZGVyIiwicHJpc21hIiwiYmNyeXB0IiwiYXV0aE9wdGlvbnMiLCJwcm92aWRlcnMiLCJuYW1lIiwiY3JlZGVudGlhbHMiLCJlbWFpbCIsImxhYmVsIiwidHlwZSIsInBhc3N3b3JkIiwiYXV0aG9yaXplIiwidXNlciIsImZpbmRVbmlxdWUiLCJ3aGVyZSIsInZhbGlkIiwiY29tcGFyZSIsImlkIiwicm9sZSIsImRlcGFydG1lbnQiLCJzZXNzaW9uIiwic3RyYXRlZ3kiLCJjYWxsYmFja3MiLCJqd3QiLCJ0b2tlbiIsInBhZ2VzIiwic2lnbkluIiwic2VjcmV0IiwicHJvY2VzcyIsImVudiIsIk5FWFRBVVRIX1NFQ1JFVCJdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(rsc)/./lib/auth.ts\n");

/***/ }),

/***/ "(rsc)/./lib/prisma.ts":
/*!***********************!*\
  !*** ./lib/prisma.ts ***!
  \***********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   prisma: () => (/* binding */ prisma)\n/* harmony export */ });\n/* harmony import */ var _prisma_client__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @prisma/client */ \"@prisma/client\");\n/* harmony import */ var _prisma_client__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_prisma_client__WEBPACK_IMPORTED_MODULE_0__);\n\nconst globalForPrisma = globalThis;\nconst prisma = globalForPrisma.prisma ?? new _prisma_client__WEBPACK_IMPORTED_MODULE_0__.PrismaClient({\n    log:  true ? [\n        \"error\"\n    ] : 0\n});\nif (true) globalForPrisma.prisma = prisma;\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9saWIvcHJpc21hLnRzIiwibWFwcGluZ3MiOiI7Ozs7OztBQUE4QztBQUU5QyxNQUFNQyxrQkFBa0JDO0FBRWpCLE1BQU1DLFNBQ1hGLGdCQUFnQkUsTUFBTSxJQUN0QixJQUFJSCx3REFBWUEsQ0FBQztJQUFFSSxLQUFLQyxLQUFzQyxHQUFHO1FBQUM7S0FBUSxHQUFHLENBQUU7QUFBQyxHQUFHO0FBRXJGLElBQUlBLElBQXFDLEVBQUVKLGdCQUFnQkUsTUFBTSxHQUFHQSIsInNvdXJjZXMiOlsid2VicGFjazovL3ZlemluLWFwcC8uL2xpYi9wcmlzbWEudHM/OTgyMiJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBQcmlzbWFDbGllbnQgfSBmcm9tIFwiQHByaXNtYS9jbGllbnRcIjtcblxuY29uc3QgZ2xvYmFsRm9yUHJpc21hID0gZ2xvYmFsVGhpcyBhcyB1bmtub3duIGFzIHsgcHJpc21hOiBQcmlzbWFDbGllbnQgfTtcblxuZXhwb3J0IGNvbnN0IHByaXNtYSA9XG4gIGdsb2JhbEZvclByaXNtYS5wcmlzbWEgPz9cbiAgbmV3IFByaXNtYUNsaWVudCh7IGxvZzogcHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09IFwiZGV2ZWxvcG1lbnRcIiA/IFtcImVycm9yXCJdIDogW10gfSk7XG5cbmlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gXCJwcm9kdWN0aW9uXCIpIGdsb2JhbEZvclByaXNtYS5wcmlzbWEgPSBwcmlzbWE7XG4iXSwibmFtZXMiOlsiUHJpc21hQ2xpZW50IiwiZ2xvYmFsRm9yUHJpc21hIiwiZ2xvYmFsVGhpcyIsInByaXNtYSIsImxvZyIsInByb2Nlc3MiXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(rsc)/./lib/prisma.ts\n");

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, ["vendor-chunks/next","vendor-chunks/next-auth","vendor-chunks/@babel","vendor-chunks/jose","vendor-chunks/openid-client","vendor-chunks/bcryptjs","vendor-chunks/oauth","vendor-chunks/object-hash","vendor-chunks/preact","vendor-chunks/uuid","vendor-chunks/yallist","vendor-chunks/preact-render-to-string","vendor-chunks/lru-cache","vendor-chunks/cookie","vendor-chunks/oidc-token-hash","vendor-chunks/@panva"], () => (__webpack_exec__("(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fleave%2Froute&page=%2Fapi%2Fleave%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fleave%2Froute.ts&appDir=C%3A%5CUsers%5CKullan%C4%B1c%C4%B1%5Cvezin-app%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=C%3A%5CUsers%5CKullan%C4%B1c%C4%B1%5Cvezin-app&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!")));
module.exports = __webpack_exports__;

})();