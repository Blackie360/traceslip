import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components"

type TransactionalEmailProps = {
  preview: string
  heading: string
  message: string
  actionLabel: string
  actionUrl: string
  footnote?: string
}

export function TransactionalEmail({
  preview,
  heading,
  message,
  actionLabel,
  actionUrl,
  footnote,
}: TransactionalEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: "#f3efe6", fontFamily: "Arial, sans-serif", margin: 0, padding: "36px 12px" }}>
        <Container style={{ backgroundColor: "#fffdf8", border: "1px solid #d6d0c4", maxWidth: 560, padding: 36 }}>
          <Text style={{ color: "#ec5f35", fontFamily: "monospace", fontSize: 12, letterSpacing: 2, margin: 0 }}>
            TRACESLIP / SOURCE-BACKED RECORDS
          </Text>
          <Heading style={{ color: "#191815", fontSize: 30, lineHeight: 1.15, margin: "18px 0 12px" }}>{heading}</Heading>
          <Text style={{ color: "#504d46", fontSize: 16, lineHeight: 1.6 }}>{message}</Text>
          <Section style={{ margin: "28px 0" }}>
            <Button href={actionUrl} style={{ backgroundColor: "#191815", color: "#fffdf8", fontSize: 14, padding: "13px 20px" }}>
              {actionLabel}
            </Button>
          </Section>
          <Hr style={{ borderColor: "#ded8cd", margin: "28px 0 18px" }} />
          <Text style={{ color: "#777167", fontFamily: "monospace", fontSize: 11, lineHeight: 1.5 }}>
            {footnote ?? "If you did not request this message, you can safely ignore it."}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
