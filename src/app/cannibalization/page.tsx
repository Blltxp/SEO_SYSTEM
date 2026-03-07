"use client"

import { useEffect, useState } from "react"

export default function CannibalPage() {

    const [data, setData] = useState<any[]>([])

    useEffect(() => {
        fetch("/api/cannibalization")
            .then(res => res.json())
            .then(setData)
    }, [])

    return (
        <div style={{ padding: 40 }}>

            <h1>Keyword Cannibalization</h1>

            {data.map((item, i) => (
                <div key={i} style={{ marginBottom: 30 }}>

                    <h2>{item.keyword}</h2>

                    <ul>
                        {item.pages.map((p: any, j: number) => (
                            <li key={j}>
                                {p.position} - {p.title} ({p.url})
                            </li>
                        ))}
                    </ul>

                </div>
            ))}

        </div>
    )
}