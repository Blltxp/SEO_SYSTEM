export type WPSite = {
    slug: string
    name: string
    api: string
}

export const sites: WPSite[] = [
    {
        slug: "maidwonderland",
        name: "แม่บ้านดีดี",
        api: "https://maidwonderland.com/wp-json/wp/v2/posts"
    },
    {
        slug: "maidsiam",
        name: "แม่บ้านสยาม",
        api: "https://maidsiam.com/wp-json/wp/v2/posts"
    },
    {
        slug: "nasaladphrao48",
        name: "nasaladphrao48",
        api: "https://nasaladphrao48.com/wp-json/wp/v2/posts"
    },
    {
        slug: "ddmaid",
        name: "แม่บ้านอินเตอร์",
        api: "https://ddmaid.com/wp-json/wp/v2/posts"
    },
    {
        slug: "ddmaidservice",
        name: "แม่บ้านดีดีเซอร์วิส",
        api: "https://แม่บ้านดีดีเซอร์วิส.com/wp-json/wp/v2/posts"
    },
    {
        slug: "suksawatmaid",
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
                if (res.status === 400 && page > 1) {
                    break
                }
                throw new Error(`WordPress API returned ${res.status} for ${siteApi} page ${page}`)
            }

            const posts: WPPost[] = await res.json()

            if (!Array.isArray(posts)) {
                throw new Error(`WordPress API returned invalid payload for ${siteApi} page ${page}`)
            }

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
        console.error("Fetch error:", siteApi, error)
        throw error
    }

    return allPosts
}

export async function fetchAllSitesPosts() {
    const result: Record<string, { name: string; posts: WPPost[] }> = {}

    for (const site of sites) {
        console.log(`Scanning site: ${site.name}`)

        const posts = await fetchAllPosts(site.api)

        console.log(`Total posts from ${site.name}:`, posts.length)

        result[site.slug] = {
            name: site.name,
            posts
        }
    }

    return result
}