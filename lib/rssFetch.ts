import axios from "axios";

export type WPPost = {
  [x: string]: string;
  id: number;
  title: string;
  link: string;
  date: string;
};

export async function fetchPosts(site: string): Promise<WPPost[]> {
  try {
    const res = await axios.get(`${site}/wp-json/wp/v2/posts`, {
      params: {
        per_page: 100,
      },
    });

    return res.data.map((post: any) => ({
      id: post.id,
      title: post.title.rendered,
      link: post.link,
      date: post.date,
    }));
  } catch (error) {
    console.error("Fetch error:", error);
    return [];
  }
}