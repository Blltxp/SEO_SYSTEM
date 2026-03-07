import Parser from "rss-parser"

const parser = new Parser()

export async function fetchPosts(site: string) {

  const feed = await parser.parseURL(`${site}/feed`)

  return feed.items.map(item => ({
    title: item.title ?? "",
    content: item.contentSnippet ?? ""
  }))

}