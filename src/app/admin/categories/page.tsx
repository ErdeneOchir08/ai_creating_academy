import { getAdminCategories } from '@/features/admin/actions/category-actions.admin'
import { CategoryManager } from '@/features/admin/components/category-manager'

export default async function AdminCategoriesPage() {
    const categories = await getAdminCategories()
    return <CategoryManager initialCategories={categories} />
}
