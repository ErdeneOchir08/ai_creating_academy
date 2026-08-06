'use server'

import { createClient } from '@/lib/supabase/server'
import {
    parseCourseUsesOfferingCheckout,
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
    const [ownershipResult, offeringsResult] = await Promise.all([
        supabase.rpc('course_uses_offering_checkout', { p_course_id: courseId }),
        supabase.rpc('list_public_course_offerings', { p_course_id: courseId }),
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
        return {
            usesOfferingCheckout: true,
            offerings: parsePublicCourseOfferings(offeringsResult.data, courseId),
            lookupFailed: false,
        }
    } catch (error) {
        console.error('Invalid public course offerings response:', error)
        return { usesOfferingCheckout: true, offerings: [], lookupFailed: true }
    }
}
