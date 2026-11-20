import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BlogPostView } from '@/components/blog/blog-post-view';
import { getPost, listPosts } from '@/lib/blog/posts';
import { JsonLd } from '@/lib/seo/jsonld';
import { postGraph, postMetadata } from '@/lib/seo/pages';

// An English guide. A slug with no content file, or one dated in the future, is a 404: that is
// what makes a publication date a schedule rather than a note.
export const revalidate = 3600;

export function generateStaticParams() {
  return listPosts('en').map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: PageProps<'/learn/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost('en', slug);
  return post ? postMetadata(post) : {};
}

export default async function LearnPostPage({ params }: PageProps<'/learn/[slug]'>) {
  const { slug } = await params;
  const post = getPost('en', slug);
  if (!post) notFound();
  return (
    <>
      <JsonLd graph={await postGraph(post)} />
      <BlogPostView post={post} />
    </>
  );
}
