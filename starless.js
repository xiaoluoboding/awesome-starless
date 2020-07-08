const requestPromise = require('request-promise')
const cheerio = require('cheerio')
const fs = require('fs')
const path = require('path')

const { repoList } = require('./constants')

class GithubRepos {
  constructor (args) {
    this.starCount = 0
    this.usedbyCount = 0
  }

  async fetchPage (repoName) {

    const url = `https://github.com/${repoName}/network/dependents`

    // Load the web page and extract meta-data
    // console.log(`Opening ${url}`)
    const html = await requestPromise({ url })

    const $ = cheerio.load(html)

    const starred = $('.social-count.js-social-count').attr('aria-label')

    const starCount = parseInt(starred.match(/\d+/g)[0], 10)
    
    const repositories = $('.btn-link.selected', '.Box-header').text()

    const number = repositories
      .replace('Repositories', '')
      .replace(/\n/g, '')
      .replace(/[\t ]/g, '')
      .replace(/,/g, '')

    const usedbyCount = parseInt(number, 10)

    this.starCount = starCount
    this.usedbyCount = usedbyCount

    const proportion = Math.floor(usedbyCount / starCount)

    const starless = {
      repoName,
      starCount,
      usedbyCount,
      proportion
    }

    return starless
  }

  renderMd (content) {
    // <!-- # | user/repo | star | used by | proportion | picture | -->
    const mdTemplate = `
# Awesome Starless

<table cellspacing="0">
  <thead>
    <th scope="col">#</th>
    <th scope="col">User/Repo</th>
    <th scope="col">Star</th>
    <!-- Language currently disabled: GitHub returns 'Shell' for most users <th scope="col">Language</th> -->
    <th scope="col">Used By</th>
    <th scope="col">Proportion</th>
  <!-- <th scope="col" width="30">Picture</th> -->
  </thead>
  <tbody>
    ${content}
  </tbody>
</table>
`
    return mdTemplate
  }

  async writeReadme (content) {
    return new Promise((resolve, reject) => {
      const output = path.resolve(__dirname, 'README.md')

      const record = content
        .sort((a, b) => b.proportion - a.proportion)
        .map((item, index) => {
          return `
  <tr>
    <th scope="row">#${index + 1}</th>
    <td><a href="https://github.com/${item.repoName}">${item.repoName}</a></td>
    <td>${item.starCount}</td>
    <td>${item.usedbyCount}</td>
    <td>${item.proportion}%</td>
  </tr>
          `
        }).toString().replace(/,/g, '')

      fs.writeFile(output, this.renderMd(record).concat('\n'), {
        encoding: 'utf-8'
      }, err => {
        err && reject(err)
        console.log('Write markdown file Done !')
        resolve({ output })
      })
    })
  }

  showTotalCount () {
    console.log(this.starCount)
    console.log(this.usedbyCount)
  }
}

(async function () {
  const gr = new GithubRepos()

  const promises = repoList.map(async repo => {
    const res = await gr.fetchPage(repo)
    return res
  })

  try {
    const result = await Promise.all(promises)

    console.log(result)

    await gr.writeReadme(result)
  } catch (error) {
    console.log(error)
  }
})()