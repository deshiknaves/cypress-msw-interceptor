const fs = require('fs')
const path = require('path')
const chalk = require('chalk')
const invariant = require('./invariant')
const packageJson = require('../package.json')

const SERVICE_WORKER_SOURCE_PATH = path.resolve(
  __dirname,
  '../',
  'src/cypress-msw-service-worker.js',
)

const SERVICE_WORKER_BUILD_PATH = path.resolve(
  __dirname,
  '../',
  path.dirname(packageJson.main),
  'src',
  path.basename(SERVICE_WORKER_SOURCE_PATH),
)

const cwd = process.cwd()

module.exports = function init(args) {
  const { publicDir } = args
  const resolvedPublicDir = path.resolve(cwd, publicDir)
  const dirExists = fs.existsSync(resolvedPublicDir)

  invariant(
    dirExists,
    'Provided directory does not exist under "%s".\nMake sure to include a relative path to the root directory of your server.',
    cwd,
  )

  console.log(
    'Initializing the Cypress — Mock Service Worker at "%s"...',
    resolvedPublicDir,
  )

  const swFilename = path.basename(SERVICE_WORKER_BUILD_PATH)
  const swDestFilepath = path.resolve(resolvedPublicDir, swFilename)

  fs.copyFile(SERVICE_WORKER_BUILD_PATH, swDestFilepath, error => {
    invariant(error == null, 'Failed to copy Service Worker. %s', error)

    console.log(`
  ${chalk.green('Service Worker successfully created!')}
  ${chalk.gray(swDestFilepath)}

  Continue by creating a mocking definition module in your application:

    ${chalk.cyan.bold('https://mswjs.io/docs/getting-started/mocks')}
  `)
  })
}
