import DashboardInitializing from '@/components/DashboardInitializing'

export default function DashboardLoading() {
  // Pass initialHasData=true to skip polling since server already has data
  return <DashboardInitializing initialHasData={true} />
}





