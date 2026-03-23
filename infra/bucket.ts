export const mediaBucket = new sst.aws.Bucket("MediaBucket", {
  access: "public",
});

export const outputs = {
  mediaBucket: mediaBucket.name,
};
