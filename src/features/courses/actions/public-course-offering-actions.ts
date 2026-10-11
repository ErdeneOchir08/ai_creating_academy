'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDirectCourseCheckout } from '@/features/checkout/domain/direct-course-checkout'
import {
    parseCourseUsesOfferingCheckout,
    parseOfferingDisplayMetadata,
    parsePublicCourseOfferings,
    type PublicCourseOffering,
} from '../domain/public-course-offering'

export type PublicCourseOfferingCheckout =
    | {
        usesOfferingCheckout: false
        offerings: []
        lookupFailed: false
    }
    | {
        usesOfferingCheckout: true
        offerings: PublicCourseOffering[]
        lookupFailed: boolean
    }

export async function getPublicCourseOfferingCheckout(
    courseId: string,
): Promise<PublicCourseOfferingCheckout> {
    const supabase = await createClient()
    const [ownershipResult, offeringsResult, metadataResult] = await Promise.all([
        supabase.rpc('course_uses_offering_checkout', { p_course_id: courseId }),
        supabase.rpc('list_public_course_offerings', { p_course_id: courseId }),
        supabase.rpc('list_public_course_offering_display_metadata', { p_course_id: courseId }),
    ])

    if (ownershipResult.error) {
        console.error('Unable to determine course checkout ownership:', ownershipResult.error.message)
        return { usesOfferingCheckout: true, offerings: [], lookupFailed: true }
    }

    let usesOfferingCheckout: boolean
    try {
        usesOfferingCheckout = parseCourseUsesOfferingCheckout(ownershipResult.data)
    } catch (error) {
        console.error('Invalid course checkout ownership response:', error)
        return { usesOfferingCheckout: true, offerings: [], lookupFailed: true }
    }

    if (!usesOfferingCheckout) {
        return { usesOfferingCheckout: false, offerings: [], lookupFailed: false }
    }

    if (offeringsResult.error) {
        console.error('Unable to load public course offerings:', offeringsResult.error.message)
        return { usesOfferingCheckout: true, offerings: [], lookupFailed: true }
    }

    try {
        const offerings = parsePublicCourseOfferings(offeringsResult.data, courseId)
        const classifications = offerings.length ? await createAdminClient().from('training_cohorts')
            .select('id, course_managed, class_type, contract_policy, delivery_mode')
            .in('id', offerings.map((offering) => offering.offering_id)) : { data: [], error: null }
        if (classifications.error) throw new Error('Unable to classify course checkout')
        const directIds = new Set((classifications.data ?? []).filter(isDirectCourseCheckout).map((item) => item.id))
        const metadata = metadataResult.error
            ? []
            : parseOfferingDisplayMetadata(metadataResult.data)
        if (metadataResult.error) {
            console.error('Unable to load course offering display metadata:', metadataResult.error.message)
        }
        const metadataByOffering = new Map(metadata.map((item) => [item.offering_id, item]))
        return {
            usesOfferingCheckout: true,
            offerings: offerings.map((offering) => ({
                ...offering,
                direct_purchase: directIds.has(offering.offering_id),
                capacity: metadataByOffering.get(offering.offering_id)?.display_capacity ?? null,
                available_seats: null,
            })),
            lookupFailed: false,
        }
    } catch (error) {
        console.error('Invalid public course offerings response:', error)
        return { usesOfferingCheckout: true, offerings: [], lookupFailed: true }
    }
}
