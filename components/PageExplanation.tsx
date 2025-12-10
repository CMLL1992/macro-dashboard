import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface PageExplanationProps {
  title: string
  description: string
  sections: Array<{
    title: string
    content: React.ReactNode
  }>
}

export default function PageExplanation({ title, description, sections }: PageExplanationProps) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {sections.map((section, index) => (
          <div key={index}>
            <h4 className="font-semibold text-foreground mb-2">{section.title}</h4>
            <div className="text-muted-foreground">{section.content}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

