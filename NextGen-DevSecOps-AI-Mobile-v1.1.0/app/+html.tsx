import { ScrollViewStyleReset } from 'expo-router/html'
import type { PropsWithChildren } from 'react'

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="description" content="NextGen DevSecOps AI — practical DevOps, DevSecOps, Application Security, GenAI and AI Security training, hands-on labs, student learning and consulting." />
        <meta name="keywords" content="DevOps training, DevSecOps training, Application Security, AppSec, GenAI, AI Security, DevSecOps consultant, corporate training, hands-on labs, Pune, India" />
        <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" />
        <meta name="theme-color" content="#070914" />
        <meta property="og:title" content="NextGen DevSecOps AI | DevOps, DevSecOps & AI Security Training" />
        <meta property="og:description" content="Practical DevOps, DevSecOps, Application Security, Generative AI and AI Security training with hands-on learning." />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="NextGen DevSecOps AI" />
        <meta property="og:locale" content="en_IN" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="NextGen DevSecOps AI | DevOps, DevSecOps & AI Security" />
        <meta name="twitter:description" content="Practical DevOps, DevSecOps, AppSec, GenAI and AI Security training, hands-on labs, student learning and consulting." />
        <meta property="og:url" content="https://nextgendevsecops.in/" />
        <link rel="canonical" href="https://nextgendevsecops.in/" />
        <script type="application/ld+json">{JSON.stringify({"@context":"https://schema.org","@graph":[{"@type":"WebSite","@id":"https://nextgendevsecops.in/#website","url":"https://nextgendevsecops.in/","name":"NextGen DevSecOps AI","description":"Practical DevOps, DevSecOps, Application Security, GenAI and AI Security training, hands-on labs and consulting."},{"@type":"EducationalOrganization","@id":"https://nextgendevsecops.in/#organization","name":"NextGen DevSecOps AI","url":"https://nextgendevsecops.in/","sameAs":["https://github.com/mmukul","https://www.youtube.com/@DevSecOps-Experts"]},{"@type":"SoftwareApplication","@id":"https://nextgendevsecops.in/#android-app","name":"NextGen DevSecOps AI","applicationCategory":"EducationalApplication","operatingSystem":"Android","softwareVersion":"1.1.0","downloadUrl":"https://github.com/mmukul/nextgen-devsecops-ai-releases/releases/download/v1.1.0/NextGen.DevSecOps.AI.v1.1.0.apk","description":"Android app for NextGen DevSecOps AI training courses, curriculum access and student learning."}]})}</script>
        <title>NextGen DevSecOps AI | DevOps, DevSecOps & AI Security Training</title>
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  )
}
