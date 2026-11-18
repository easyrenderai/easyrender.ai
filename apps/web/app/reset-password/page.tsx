import {
  ServiceAuthPage,
  type ServiceAuthProps,
  serviceAuthMetadata,
} from '@/components/service-auth-page';

export const dynamic = 'force-dynamic';
export const generateMetadata = () => serviceAuthMetadata('resetTitle');

export default function Page(props: ServiceAuthProps) {
  return <ServiceAuthPage mode="reset" {...props} />;
}
