"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPreset = void 0;
const pkg = require('../../package.json');
const ns = pkg.name.split('/')[0];
function createPreset(rules) {
    return {
        rules: Object.keys(rules).reduce((acc, key) => {
            acc[`${ns}/${key}`] = rules[key];
            return acc;
        }, {})
    };
}
exports.createPreset = createPreset;
