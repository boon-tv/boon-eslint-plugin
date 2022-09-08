# @boon-tv/eslint-plugin

## Installation

### Yarn
```
yarn add -D @boon-tv/eslint-plugin
```

### NPM
```
npm i --dev @boon-tv/eslint-plugin
```

## Configuration

Add the plugin and preset to your eslint config (`parserOptions.project` is also required):
```json
{
    "plugins": ["@boon-tv"],
    "extends": ["plugin:@boon-tv/recommended"],
    "parserOptions": {
        "project": "./tsconfig.json"
    }
}
```

## Rules

### @boon-tv/strict-short-circuit-expressions

Provides more strict rules to short circuit expressions. 
This is particularly useful when working with `react` and even more so with `react-native` where 
leaking unwanted variables into JSX can lead to crashes.

The rule only triggers in inline conditional statements while special statements such as `if`, `while` and `for` are ignored.

Here are some examples of statements that will trigger and error and their allowed alternative:

```ts
// String & nullish string variables
variable && result  // ❌
!!variable && result // ✅

// Number & nulish number variables
variable && result  // ❌
arrayVaraible.length && result // ❌
!!variable && result // ✅
!!arrayVariable.length && result // ✅
arrayVariable.length > 0 && result // ✅

// Object & nulish object variables
variable && result  // ❌
!!variable && result // ✅

// "any" variables
variable && result  // ❌
!!variable && result // ✅
```
