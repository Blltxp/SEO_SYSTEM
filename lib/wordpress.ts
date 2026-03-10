export type WPSite = {
    name: string
    api: string
}

export const sites: WPSite[] = [
    {
        name: "แม่บ้านดีดี",
        api: "https://maidwonderland.com/wp-json/wp/v2/posts"
    },
    {
        name: "แม่บ้านสยาม",
        api: "https://maidsiam.com/wp-json/wp/v2/posts"
    },
    {
        name: "nasaladphrao48",
        api: "https://nasaladphrao48.com/wp-json/wp/v2/posts"
    },
    {
        name: "แม่บ้านอินเตอร์",
        api: "https://ddmaid.com/wp-json/wp/v2/posts"
    },
    {
        name: "แม่บ้านดีดีเซอร์วิส",
        api: "https://แม่บ้านดีดีเซอร์วิส.com/wp-json/wp/v2/posts"
    },
    {
        name: "แม่บ้านสุขสวัสดิ์",
        api: "https://แม่บ้านสุขสวัสดิ์.com/wp-json/wp/v2/posts"
    }
]

export type WPPost = {
    id: number
    date: string
    slug: string
    link: string
    title: {
        rendered: string
    }
    content: {
        rendered: string
    }
}

export async function fetchAllPosts(siteApi: string): Promise<WPPost[]> {
    const allPosts: WPPost[] = []
    let page = 1
    const perPage = 100

    try {
        while (true) {
            const url = `${siteApi}?per_page=${perPage}&page=${page}`

            const res = await fetch(url)

            if (!res.ok) {
                break
            }

            const posts: WPPost[] = await res.json()

            if (!posts || posts.length === 0) {
                break
            }

            allPosts.push(...posts)

            if (posts.length < perPage) {
                break
            }

            page++
        }
    } catch (error) {
        console.error("Fetch error:", siteApi)
    }

    return allPosts
}

export async function fetchAllSitesPosts() {
    const result: Record<string, WPPost[]> = {}

    for (const site of sites) {
        console.log(`Scanning site: ${site.name}`)

        const posts = await fetchAllPosts(site.api)

        console.log(`Total posts from ${site.name}:`, posts.length)

        result[site.name] = posts
    }

    return result
}