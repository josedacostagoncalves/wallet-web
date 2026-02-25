import Image from "next/image";
import type { ReactNode } from "react";

type Props = {
    src?: string | null;
    alt?: string;
    size: number;
    className?: string;
    fallback?: ReactNode;
};

export function AvatarImage({
    src,
    alt = "",
    size,
    className,
    fallback = null,
}: Props) {
    if (!src) return <>{fallback}</>;

    return (
        <Image
            src={src}
            alt={alt}
            width={size}
            height={size}
            unoptimized
            className={className}
        />
    );
}
