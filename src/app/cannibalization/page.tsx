"use client"

import { useEffect, useState } from "react"

export default function Page() {

  const [data, setData] = useState<any[]>([])

  useEffect(() => {

    fetch("/api/cannibalization")
      .then(r => r.json())
      .then(setData)

  }, [])

  return (
    <div style={{ padding: 40 }}>

      <h1>Keyword Cannibalization</h1>

      {data.map((item, i) => (

        <div key={i}>

          <h2>{item.keyword}</h2>

          <ul>
            {item.pages.map((p: any, j: number) => (
              <li key={j}>
                {p.source}
              </li>
            ))}
          </ul>

        </div>

      ))}

    </div>
  )
}