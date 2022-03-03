const pkg = require('../../package.json')
const ns = pkg.name.split('/')[0]

export function createPreset(rules: Record<string, unknown>) {
    return {
        rules: Object.keys(rules).reduce((acc, key) => {
            acc[`${ns}/${key}`] = rules[key]
            return acc
        }, {} as Record<string, unknown>)
    }
}