module.exports = {
    "extends": [
      "standard"
    ],
    "rules": {
      "space-before-function-paren": ["error", "never"],
      "comma-dangle": ["error", {
        "arrays": "ignore",
        "objects": "ignore",
        "imports": "ignore",
        "exports": "ignore",
        "functions": "ignore"
      }],
      "quotes": "off",
      "comma-spacing": "off",
      "key-spacing": "off",
      "space-infix-ops": "off",
      "semi-spacing": "off",
      "react/display-name": "off"
    }
};
