"use client";

import { z } from "zod";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { createPost, updatePost } from "@/actions/post-actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Image from "next/image";

const PRESET_CATEGORIES = [
    "General",
    "Web Development",
    "Next.js",
    "UI/UX",
    "Authentication",
    "Database",
    "DevOps",
    "Performance",
];

//post form schema for validation

const postSchema = z.object({
    title: z.string()
        .min(1, "Title must be atleast one character")
        .max(255, "Title must be less than 256 characters"),
    description: z.string()
        .min(1, "Description must be atleast one character")
        .max(255, "Description must be less than 256 characters"),
    category: z.string()
        .min(2, "Category should be at least 2 characters")
        .max(80, "Category should be less than 81 characters"),
    tags: z.string().max(300, "Tags input is too long"),
    customCategory: z.string().trim().optional(),
    coverImage: z.string()
        .trim()
        .optional()
        .refine((value) => !value || /^https?:\/\/.+/i.test(value) || value.startsWith("/"), {
            message: "Cover image must be a valid URL or uploaded image"
        }),
    publishMode: z.enum(["publish", "draft", "schedule"]),
    scheduledAt: z.string().optional(),
    content: z.string()
        .min(1, "Content must be atleast one character")
        .max(10000, "Content must be less than 10000 characters"),

}).refine((data) => {
    if (data.category !== "other") {
        return true;
    }

    return Boolean(data.customCategory && data.customCategory.trim().length >= 2);
}, {
    message: "Please enter your custom category",
    path: ["customCategory"]
})

type PostFormValues = z.infer<typeof postSchema>;

interface PostFormProps {
    isEditing?: boolean;
    post?: {
        id: number,
        title: string,
        description: string,
        category: string,
        tags?: string,
        coverImage: string | null,
        status?: string,
        scheduledAt?: string | null,
        content: string,
        slug: string
    }
}

function PostForm({ isEditing, post }: PostFormProps) {

    const [isPending, startTransition] = useTransition();
    const router = useRouter();
    const currentCategory = post?.category ?? "General";
    const hasCustomCategory = !PRESET_CATEGORIES.includes(currentCategory);
    const [selectedCategory, setSelectedCategory] = useState<string>(hasCustomCategory ? "other" : currentCategory);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string>(post?.coverImage ?? "");
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [imageInputMode, setImageInputMode] = useState<"file" | "url">(
        post?.coverImage && !post.coverImage.startsWith("/api/") ? "url" : "file"
    );

    const { register, handleSubmit, setValue, formState: { errors } } = useForm<PostFormValues>({
        resolver: zodResolver(postSchema),
        defaultValues: isEditing && post ? {
            title: post?.title,
            description: post?.description,
            category: hasCustomCategory ? "other" : post?.category,
            tags: post?.tags ?? "",
            customCategory: hasCustomCategory ? post?.category : "",
            coverImage: post?.coverImage ?? "",
            publishMode: post?.status === "draft" ? "draft" : post?.status === "scheduled" ? "schedule" : "publish",
            scheduledAt: post?.scheduledAt ?? "",
            content: post?.content
        } : {
            title: "",
            description: "",
            category: "General",
            tags: "",
            customCategory: "",
            coverImage: "",
            publishMode: "publish",
            scheduledAt: "",
            content: ""
        }
    })

    const handleCategoryChange = (value: string) => {
        setSelectedCategory(value);
        setValue("category", value, { shouldValidate: true, shouldDirty: true });

        if (value !== "other") {
            setValue("customCategory", "", { shouldValidate: true, shouldDirty: true });
        }
    }

    const handleImagePick = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];

        if (!file) {
            return;
        }

        if (!file.type.startsWith("image/")) {
            toast.error("Please select a valid image file");
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error("Please choose an image smaller than 5MB");
            return;
        }

        if (imagePreview.startsWith("blob:")) {
            URL.revokeObjectURL(imagePreview);
        }

        setSelectedFile(file);
        setImagePreview(URL.createObjectURL(file));
        setValue("coverImage", "", { shouldValidate: true });
    }

    const handleImageUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const url = e.target.value.trim();
        if (imagePreview.startsWith("blob:")) {
            URL.revokeObjectURL(imagePreview);
        }
        setSelectedFile(null);
        setImagePreview(url);
        setValue("coverImage", url, { shouldValidate: true, shouldDirty: true });
    }

    const clearCoverImage = () => {
        if (imagePreview.startsWith("blob:")) {
            URL.revokeObjectURL(imagePreview);
        }

        setSelectedFile(null);
        setValue("coverImage", "", { shouldValidate: true, shouldDirty: true });
        setImagePreview("");
    }

    const onFormSubmit = async (data: PostFormValues) => {

        const finalCategory = data.category === "other"
            ? String(data.customCategory ?? "").trim()
            : data.category;

        startTransition(async () => {
            try {
                setIsUploadingImage(true);

                let uploadedCoverImage = (data.coverImage ?? "").trim();

                if (selectedFile) {
                    const uploadFormData = new FormData();
                    uploadFormData.append("file", selectedFile);

                    const uploadResponse = await fetch("/api/upload", {
                        method: "POST",
                        body: uploadFormData,
                    });

                    if (!uploadResponse.ok) {
                        const uploadError = await uploadResponse.json().catch(() => ({ message: "Image upload failed" }));
                        throw new Error(uploadError.message || "Image upload failed");
                    }

                    const uploadResult = await uploadResponse.json();
                    uploadedCoverImage = uploadResult.secureUrl;
                }

                const formData = new FormData()
                formData.append("title", data.title)
                formData.append("description", data.description)
                formData.append("category", finalCategory)
                formData.append("tags", data.tags)
                formData.append("coverImage", uploadedCoverImage)
                formData.append("publishMode", data.publishMode)
                formData.append("scheduledAt", data.scheduledAt ?? "")
                formData.append("content", data.content)

                let res; 

                if(isEditing && post){

                    res = await updatePost(post.id, formData)
                }else{
                    res = await createPost(formData);
                }


                if (res.success) {
                    toast.success(!isEditing ? "Post created Successfully!! :)" : "Post Edited Successfully!! :)");
                    router.refresh()
                    router.push("/")
                } else {
                    toast.error(res.message || "Failed to save post");
                }

            } catch (e) {
                console.error("Post submit error:", e);
                const msg = e instanceof Error ? e.message : "Failed To Create a Post!! :(";
                toast.error(msg);
            } finally {
                setIsUploadingImage(false);
            }
        })

    }

    return (
        <form className="space-y-6" onSubmit={handleSubmit(onFormSubmit)}>
            <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" placeholder="Enter Post Title"
                    {...register("title")}
                    disabled={isPending} />
                {
                    errors?.title &&
                    <p className="text-sm text-red-700">{errors.title.message}</p>
                }
            </div>

            <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description"
                    placeholder="Enter post description"
                    {...register("description")}
                    disabled={isPending} />
                {
                    errors?.description &&
                    <p className="text-sm text-red-700">{errors.description.message}</p>
                }
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <select
                        id="category"
                        value={selectedCategory}
                        onChange={(e) => handleCategoryChange(e.target.value)}
                        disabled={isPending || isUploadingImage}
                        className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:[color-scheme:dark]"
                    >
                        {PRESET_CATEGORIES.map((category) => (
                            <option key={category} value={category} className="bg-background text-foreground">
                                {category}
                            </option>
                        ))}
                        <option value="other" className="bg-background text-foreground">Other</option>
                    </select>
                    <input type="hidden" {...register("category")} />
                    {
                        errors?.category &&
                        <p className="text-sm text-red-700">{errors.category.message}</p>
                    }

                    {selectedCategory === "other" ? (
                        <div className="space-y-2 pt-1">
                            <Input
                                placeholder="Enter your category"
                                {...register("customCategory")}
                                disabled={isPending || isUploadingImage}
                            />
                            {errors?.customCategory ? (
                                <p className="text-sm text-red-700">{errors.customCategory.message}</p>
                            ) : null}
                        </div>
                    ) : null}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="tags">Tags</Label>
                    <Input
                        id="tags"
                        placeholder="nextjs, auth, db"
                        {...register("tags")}
                        disabled={isPending || isUploadingImage}
                    />
                    <p className="text-xs text-muted-foreground">Use commas to separate tags.</p>
                    {
                        errors?.tags &&
                        <p className="text-sm text-red-700">{errors.tags.message}</p>
                    }
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="coverImage">Cover Image</Label>
                        <div className="inline-flex rounded-lg border border-border/80 bg-muted/40 p-0.5 text-xs">
                            <button
                                type="button"
                                onClick={() => setImageInputMode("file")}
                                className={`rounded-md px-2 py-0.5 font-medium transition ${
                                    imageInputMode === "file"
                                        ? "bg-background text-foreground shadow-xs"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                File Upload
                            </button>
                            <button
                                type="button"
                                onClick={() => setImageInputMode("url")}
                                className={`rounded-md px-2 py-0.5 font-medium transition ${
                                    imageInputMode === "url"
                                        ? "bg-background text-foreground shadow-xs"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                Image URL
                            </button>
                        </div>
                    </div>

                    {imageInputMode === "file" ? (
                        <>
                            <Input
                                id="coverImageFile"
                                type="file"
                                accept="image/*"
                                onChange={handleImagePick}
                                disabled={isPending || isUploadingImage}
                            />
                            <p className="text-xs text-muted-foreground">Upload from device (max 5MB). Stored automatically in database / Cloudinary.</p>
                        </>
                    ) : (
                        <>
                            <Input
                                id="coverImageUrl"
                                type="url"
                                placeholder="https://images.unsplash.com/photo-..."
                                defaultValue={post?.coverImage ?? ""}
                                onChange={handleImageUrlChange}
                                disabled={isPending || isUploadingImage}
                            />
                            <p className="text-xs text-muted-foreground">Paste a direct image URL (Unsplash, Cloudinary, etc.).</p>
                        </>
                    )}

                    <input type="hidden" {...register("coverImage")} />

                    {imagePreview ? (
                        <div className="overflow-hidden rounded-md border border-border/80">
                            <div className="relative h-36 w-full bg-muted/30">
                                <Image
                                    src={imagePreview}
                                    alt="Cover preview"
                                    fill
                                    sizes="100vw"
                                    className="object-cover"
                                    unoptimized
                                />
                            </div>
                            <div className="p-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={clearCoverImage}
                                    disabled={isPending || isUploadingImage}
                                >
                                    Remove Image
                                </Button>
                            </div>
                        </div>
                    ) : null}

                    {errors?.coverImage && (
                        <p className="text-sm text-red-700">{errors.coverImage.message}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="publishMode">Publish Mode</Label>
                    <select
                        id="publishMode"
                        defaultValue={isEditing && post?.status === "draft" ? "draft" : isEditing && post?.status === "scheduled" ? "schedule" : "publish"}
                        {...register("publishMode")}
                        disabled={isPending || isUploadingImage}
                        className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:[color-scheme:dark]"
                    >
                        <option value="publish" className="bg-background text-foreground">Publish now</option>
                        <option value="draft" className="bg-background text-foreground">Save as draft</option>
                        <option value="schedule" className="bg-background text-foreground">Schedule</option>
                    </select>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="scheduledAt">Scheduled Date</Label>
                    <Input
                        id="scheduledAt"
                        type="datetime-local"
                        {...register("scheduledAt")}
                        disabled={isPending || isUploadingImage}
                    />
                    <p className="text-xs text-muted-foreground">Used only when publish mode is set to Schedule.</p>
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="content">Content</Label>
                <Textarea id="Content"
                    placeholder="Enter post content"
                    className="min-h-72 resize-none"
                    {...register("content")}
                    disabled={isPending || isUploadingImage} />
                {
                    errors?.content &&
                    <p className="text-sm text-red-700">{errors.content.message}</p>
                }
            </div>
            <Button type={"submit"} className="mt-5" disabled={isPending || isUploadingImage}>

                {
                    (isPending || isUploadingImage) ? 
                    "Saving Post..." : 
                    (!isEditing?"Create Post": "Update Post")
                }

            </Button>
        </form>
    )
}

export default PostForm