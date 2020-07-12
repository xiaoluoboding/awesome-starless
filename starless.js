const requestPromise = require('request-promise')
const cheerio = require('cheerio')
const fs = require('fs')
const path = require('path')

const { Octokit } = require('@octokit/rest')

const octokit = new Octokit({
  previews: ["mercy-preview"]
})

const { repoList } = require('./constants')

class Starless {
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

    const repoInfo = await this.fetchApi(repoName)

    const starless = {
      repoName,
      starCount,
      usedbyCount,
      proportion,
      picture: repoInfo.owner.avatar_url
    }

    return starless
  }

  async fetchApi (repoName) {
    const owner = repoName.split('/').shift()
    const repo = repoName.split('/').pop()
    const res = await octokit.repos.get({
      owner,
      repo,
      mediaType: { previews: ["symmetra"] }
    })

    return res.data
  }

  renderMd (content) {
    // <!-- # | user/repo | star | used by | proportion | picture | -->

    const datetime = () => {
      let t = new Date()
      t.setDate(t.getDate())

      t.setTime(t.getTime())

      const date = t.toISOString().split('T')[0]

      const time = t.toTimeString().split(' ')[0]

      return `${date} ${time}`
    }

    const mdTemplate = `
# Awesome Starless [![Awesome](https://awesome.re/badge.svg)](https://awesome.re) [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)

A curated list of awesome repositories with few stargazers but many users.

Most of these repositories were the cornerstone of front-end development.

## How defined **Starless**

I recommend the repos is usefully and the stargazers were disproportionate to the used by count.

---

> Generated at ${datetime()}.

---

<table cellspacing="0">
  <thead>
    <th scope="col">#</th>
    <th scope="col">Owner/Repo</th>
    <th scope="col">Star</th>
    <!-- Language currently disabled: GitHub returns 'Shell' for most users <th scope="col">Language</th> -->
    <th scope="col">Used By</th>
    <th scope="col">Proportion</th>
    <th scope="col" width="30">Picture</th>
  </thead>
  <tbody>
    ${content}
  </tbody>
</table>

## Credits

Inspired by [Most active GitHub users](https://gist.github.com/paulmillr/2657075)

## License

MIT © [xiaoluoboding](https://github.com/xiaoluoboding)

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
    <td>${item.proportion}</td>
    <td><a target="_black" href="https://github.com/${item.repoName.split('/').shift()}"><img width="30" height="30" src="${item.picture}"></a></td></tr>
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
  const starless = new Starless()

  const promises = repoList.map(async repo => {
    const res = await starless.fetchPage(repo)
    return res
  })

  try {
    const result = await Promise.all(promises)

    console.dir(result)

    await starless.writeReadme(result)
  } catch (error) {
    console.log(error)
  }
})()