import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LanguageProvider } from './language-provider'
import { CourseCard } from '@/features/courses/components/course-card'
import type { Locale } from '@/lib/i18n/locale'

function renderCard(locale: Locale) {
    return renderToStaticMarkup(
        <LanguageProvider locale={locale}>
            <CourseCard course={{
                id: 'test-course', title: 'Монгол сургалтын нэр', description: 'Багшийн бичсэн агуулга',
                thumbnail_url: '', price_display: '₮ 69,000', payment_status: 'enrolled',
            }} />
        </LanguageProvider>,
    )
}

describe('bilingual course interface', () => {
    it('renders English on the server while preserving authored content and enrollment links', () => {
        const html = renderCard('en')
        expect(html).toContain('View course')
        expect(html).toContain('Enrolled')
        expect(html).toContain('Монгол сургалтын нэр')
        expect(html).toContain('Багшийн бичсэн агуулга')
        expect(html).toContain('/courses/test-course')
        expect(html).not.toContain('Хичээл үзэх')
    })

    it('renders the original Mongolian labels when switching back', () => {
        const html = renderCard('mn')
        expect(html).toContain('Хичээл үзэх')
        expect(html).toContain('Элссэн')
        expect(html).toContain('/courses/test-course')
    })
})
