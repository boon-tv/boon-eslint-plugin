"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const rules_1 = __importDefault(require("./rules"));
const recommended_1 = __importDefault(require("./configs/recommended"));
module.exports = {
    rules: rules_1.default,
    configs: {
        recommended: recommended_1.default,
    },
};
