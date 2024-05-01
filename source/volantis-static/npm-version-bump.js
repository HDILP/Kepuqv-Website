const fs = require('fs/promises')

const pageageFile = {
  "name": "volantis-static",
  "version": `0.0.${Date.now()}`,
  "description": "This is volantis static",
  "main": "README.md",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/volantis-x/volantis-static.git"
  },
  "dependencies": {
  },
  "keywords": ["volantis", "static"],
  "author": "Volantis Team",
  "license": "The Unlicense",
  "bugs": {
    "url": "https://github.com/volantis-x/volantis-static/issues"
  },
  "homepage": "https://github.com/volantis-x/volantis-static#readme"
}
const pageageFileStr = JSON.stringify(pageageFile)
fs.writeFile('./package.json', pageageFileStr, 'utf8', (err) => {
  if (err) throw err
})

